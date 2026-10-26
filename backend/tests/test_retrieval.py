"""Logic tests use a fake tokenizer/embedder; FAISS and PDF extraction are real."""
import hashlib
import json
from pathlib import Path
import re
import tempfile
import unittest
from unittest.mock import patch

import numpy as np
from fastapi.testclient import TestClient
from pydantic import HttpUrl

from app.cli.index_documents import build
from app.core.config import Settings
from app.main import create_app
from app.rag.chunking import make_chunks, prefixed
from app.rag.embeddings import ModelUnavailable
from app.rag.index_store import chunk_config, load_bundle, publish
from app.rag.loaders import extract, read_manifest
from app.rag.retriever import Retriever

FIXTURES = Path(__file__).parent / "fixtures"


class FakeTokenizer:
    def __call__(self, text, add_special_tokens=True, return_offsets_mapping=False, **kwargs):
        offsets = [(m.start(), m.end()) for m in re.finditer(r"\S+", text)]
        result = {"input_ids": list(range(len(offsets) + (2 if add_special_tokens else 0)))}
        if return_offsets_mapping:
            result["offset_mapping"] = offsets
        return result


class FakeEmbedder:
    tokenizer = FakeTokenizer()
    limit = 512
    dimension = 8
    identity = {"model_id": "fake-test-only", "revision": "a" * 40, "dimension": 8,
                "max_tokens": 512, "passage_prefix": "passage: ",
                "query_prefix": "query: ", "normalized": True}

    def encode(self, texts, kind):
        vectors = np.array([list(hashlib.sha256(prefixed(t, kind).encode()).digest()[:8])
                            for t in texts], dtype="float32") + 1
        return vectors / np.linalg.norm(vectors, axis=1, keepdims=True)


class RetrievalTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.settings = Settings(_env_file=None, data_dir=FIXTURES / "documents",
                                 index_dir=self.root / "indexes", retrieval_enabled=True,
                                 app_env="development")
        self.model = FakeEmbedder()

    def build(self):
        return build(self.settings, FIXTURES / "manifest.json", self.settings.index_dir, self.model)

    def test_vietnamese_sections_tokens_and_stable_ids(self):
        doc, file = read_manifest(FIXTURES / "manifest.json", self.settings.data_dir)[0]
        digest, sections = extract(file)
        self.assertIn("Tra cứu lịch học", [s[0] for s in sections])
        self.assertTrue(any("| Phiên bản |" in s[1] for s in sections))
        sections = [(1, "Tiếng Việt có dấu và bảng biểu " * 50), (2, "Trang thứ hai")]
        chunks = make_chunks(doc, sections, digest, "now", self.model.tokenizer, 20, 3, 512)
        repeated = make_chunks(doc, sections, digest, "later", self.model.tokenizer, 20, 3, 512)
        self.assertEqual([c.chunk_id for c in chunks], [c.chunk_id for c in repeated])
        self.assertEqual({c.page_or_section for c in chunks}, {1, 2})
        self.assertEqual(chunks[-1].text, "Trang thứ hai")
        for chunk in chunks:
            self.assertLessEqual(len(self.model.tokenizer(prefixed(chunk.text, "passage"))["input_ids"]), 20)
        self.assertEqual(prefixed("passage: passage: Tiếng Việt", "passage"), "passage: Tiếng Việt")

    def test_pdf_pages_and_no_text_rejection(self):
        from pypdf import PdfWriter
        from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject

        writer = PdfWriter()
        font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'),
                                 NameObject('/BaseFont'): NameObject('/Helvetica')})
        for label in ("First page", "Second page"):
            page = writer.add_blank_page(width=400, height=400)
            page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): writer._add_object(font)})})
            stream = DecodedStreamObject()
            stream.set_data(f'BT /F1 12 Tf 40 300 Td ({label}) Tj ET'.encode())
            page[NameObject('/Contents')] = writer._add_object(stream)
        file = self.root / 'pages.pdf'
        writer.write(file)
        _, pages = extract(file)
        self.assertEqual(pages, [(1, 'First page'), (2, 'Second page')])
        empty = PdfWriter()
        empty.add_blank_page(width=400, height=400)
        empty.write(self.root / 'scan.pdf')
        with self.assertRaisesRegex(ValueError, 'OCR'):
            extract(self.root / 'scan.pdf')
        (self.root / 'empty.txt').write_text(' \n ', encoding='utf-8')
        with self.assertRaises(ValueError):
            extract(self.root / 'empty.txt')

    def test_manifest_rejects_traversal_and_duplicate_id(self):
        docs = json.loads((FIXTURES / 'manifest.json').read_text(encoding='utf-8'))
        docs[0]['file'] = '../manifest.json'
        manifest = self.root / 'manifest.json'
        manifest.write_text(json.dumps(docs), encoding='utf-8')
        with self.assertRaises(ValueError):
            read_manifest(manifest, self.settings.data_dir)
        docs[0] = docs[1]
        manifest.write_text(json.dumps(docs), encoding='utf-8')
        with self.assertRaises(ValueError):
            read_manifest(manifest, self.settings.data_dir)

    def test_roundtrip_and_filter_before_top_k(self):
        result = self.build()
        manifest, chunks, index = load_bundle(self.settings.index_dir)
        self.assertEqual(index.ntotal, result['chunks'])
        self.assertEqual(manifest['index_version'], result['index_version'])
        retriever = Retriever(self.settings, self.model)
        # Even if the sole eligible chunk is last in the global ranking, it must survive.
        global_results = retriever.search('lịch học', 10)
        last = global_results[-1]
        filtered = retriever.search('lịch học', 1, last['category'], last['applicable_year'])
        self.assertTrue(filtered)
        self.assertEqual(filtered[0]['category'], last['category'])
        self.assertEqual(filtered[0]['applicable_year'], last['applicable_year'])
        self.assertEqual(retriever.search('test', 5, applicable_year=2099), [])
        self.assertTrue(all(c.content_hash and c.indexed_at for c in chunks))

    def test_filter_finds_candidate_outside_global_top_k(self):
        self.build()
        manifest, chunks, _ = load_bundle(self.settings.index_dir)
        vectors = np.zeros((len(chunks), 8), dtype='float32')
        for i, chunk in enumerate(chunks):
            vectors[i, 0 if chunk.category == 'academic' else 1] = 1
        publish(self.settings.index_dir, chunks, vectors, self.model.identity,
                chunk_config(self.settings), manifest['documents'])
        retriever = Retriever(self.settings, self.model)
        query = np.zeros((1, 8), dtype='float32')
        query[0, 0] = 1
        with patch.object(self.model, 'encode', return_value=query):
            self.assertEqual(retriever.search('x', 1)[0]['category'], 'academic')
            result = retriever.search('x', 1, category='admissions', applicable_year=2026)
            self.assertEqual(len(result), 1)
            self.assertEqual(result[0]['category'], 'admissions')

    def test_failed_index_keeps_active_and_never_overwrites_old_bundle(self):
        first = self.build()
        pointer = (self.settings.index_dir / 'active.json').read_bytes()
        with patch.object(self.model, 'encode', side_effect=RuntimeError('embedding failure')):
            with self.assertRaises(RuntimeError):
                self.build()
        self.assertEqual((self.settings.index_dir / 'active.json').read_bytes(), pointer)
        with patch('app.rag.index_store.os.replace', side_effect=OSError('publication failure')):
            with self.assertRaises(OSError):
                self.build()
        self.assertEqual(load_bundle(self.settings.index_dir)[0]['index_version'], first['index_version'])
        second = self.build()
        self.assertNotEqual(first['index_version'], second['index_version'])
        self.assertTrue((self.settings.index_dir / first['index_version'] / 'vectors.faiss').exists())

    def test_cli_invalid_manifest_returns_nonzero_without_changing_active(self):
        import os
        import subprocess
        import sys

        self.build()
        pointer = (self.settings.index_dir / 'active.json').read_bytes()
        manifest = self.root / 'empty.json'
        manifest.write_text('[]', encoding='utf-8')
        process = subprocess.run(
            [sys.executable, '-m', 'app.cli.index_documents', '--manifest', str(manifest),
             '--output', str(self.settings.index_dir), '--data-dir', str(self.settings.data_dir)],
            capture_output=True, cwd=Path(__file__).resolve().parents[1],
            env=dict(os.environ, HF_HUB_OFFLINE='1'),
        )
        self.assertNotEqual(process.returncode, 0)
        self.assertEqual((self.settings.index_dir / 'active.json').read_bytes(), pointer)

    def test_rejects_corruption_missing_files_and_model_mismatch(self):
        result = self.build()
        bundle = self.settings.index_dir / result['index_version']
        with self.assertRaises(ValueError):
            load_bundle(self.settings.index_dir, expected_model={})
        wrong_model = FakeEmbedder()
        wrong_model.identity = {**self.model.identity, 'revision': 'b' * 40}
        with self.assertRaises(ValueError):
            Retriever(self.settings, wrong_model)
        other = self.settings.model_copy(update={'chunk_size': 200})
        with self.assertRaises(ValueError):
            Retriever(other, self.model)
        original = (bundle / 'chunks.json').read_bytes()
        (bundle / 'chunks.json').write_bytes(original + b' ')
        with self.assertRaisesRegex(ValueError, 'checksum'):
            load_bundle(self.settings.index_dir)
        (bundle / 'chunks.json').unlink()
        with self.assertRaises(FileNotFoundError):
            load_bundle(self.settings.index_dir)

    def test_vector_count_and_source_mapping_validation(self):
        self.build()
        manifest, chunks, index = load_bundle(self.settings.index_dir)
        pointer = (self.settings.index_dir / 'active.json').read_bytes()
        with self.assertRaises(ValueError):
            publish(self.settings.index_dir, chunks, index.reconstruct_n(0, 1),
                    self.model.identity, chunk_config(self.settings), manifest['documents'])
        broken = [chunks[0].model_copy(update={'source_url': HttpUrl('https://example.org/wrong')}), *chunks[1:]]
        with self.assertRaisesRegex(ValueError, 'source mapping'):
            publish(self.settings.index_dir, broken, index.reconstruct_n(0, index.ntotal),
                    self.model.identity, chunk_config(self.settings), manifest['documents'])
        self.assertEqual((self.settings.index_dir / 'active.json').read_bytes(), pointer)

    def test_readiness_search_validation_and_disabled_production_route(self):
        disabled = self.settings.model_copy(update={'retrieval_enabled': False})
        with TestClient(create_app(disabled, lambda _: self.fail('disabled retrieval loaded model'))) as client:
            self.assertEqual(client.get('/health').status_code, 200)
            self.assertEqual(client.get('/ready').status_code, 503)
            self.assertEqual(client.post('/api/search', json={'query': 'lịch học'}).status_code, 503)
        with TestClient(create_app(self.settings)) as client:
            self.assertEqual(client.get('/health').status_code, 200)
            self.assertEqual(client.get('/ready').json()['reason'], 'retrieval_index_missing')
        self.build()
        with TestClient(create_app(self.settings, lambda s: Retriever(s, self.model))) as client:
            self.assertEqual(client.get('/ready').status_code, 200)
            with patch.object(self.model, 'encode', side_effect=AssertionError('probe must not embed')):
                self.assertEqual(client.get('/health').status_code, 200)
                self.assertEqual(client.get('/ready').status_code, 200)
            response = client.post('/api/search', json={'query': 'lịch học', 'category': 'academic'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['request_id'], response.headers['X-Request-ID'])
            self.assertTrue(all(r['category'] == 'academic' for r in response.json()['results']))
            for body in ({'query': ' '}, {'query': 'x', 'top_k': 11}, {'query': 'x' * 2001}):
                self.assertEqual(client.post('/api/search', json=body).status_code, 422)
        production = self.settings.model_copy(update={'app_env': 'production', 'retrieval_enabled': False})
        with TestClient(create_app(production)) as client:
            self.assertEqual(client.post('/api/search', json={'query': 'x'}).status_code, 404)
        with TestClient(create_app(self.settings, lambda _: (_ for _ in ()).throw(ModelUnavailable()))) as client:
            self.assertEqual(client.get('/health').status_code, 200)
            self.assertEqual(client.get('/ready').json()['reason'], 'retrieval_model_unavailable')


if __name__ == '__main__':
    unittest.main(verbosity=2)
