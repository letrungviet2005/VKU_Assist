import hashlib
import json
from pathlib import Path
import re
import tempfile

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.cli.index_documents import build
from app.core.config import Settings
from app.main import create_app
from app.rag.chunking import prefixed
from app.rag.retriever import Retriever
from app.schemas.chat import HistoryTurn
from app.services.chat_service import condense_query

FIXTURES = Path(__file__).parent / "fixtures"


class _FakeTokenizer:
    def __call__(self, text, add_special_tokens=True, return_offsets_mapping=False, **kwargs):
        offsets = [(m.start(), m.end()) for m in re.finditer(r"\S+", text)]
        result = {"input_ids": list(range(len(offsets) + (2 if add_special_tokens else 0)))}
        if return_offsets_mapping:
            result["offset_mapping"] = offsets
        return result


class _FakeEmbedder:
    tokenizer = _FakeTokenizer()
    limit = 512
    dimension = 8
    identity = {
        "model_id": "fake-test-only",
        "revision": "a" * 40,
        "dimension": 8,
        "max_tokens": 512,
        "passage_prefix": "passage: ",
        "query_prefix": "query: ",
        "normalized": True,
    }

    def encode(self, texts, kind):
        vectors = np.array(
            [list(hashlib.sha256(prefixed(t, kind).encode()).digest()[:8]) for t in texts],
            dtype="float32",
        ) + 1
        return vectors / np.linalg.norm(vectors, axis=1, keepdims=True)


class StubLibraryRetriever:
    version = "lib-test-v1"

    def __init__(self, items=None):
        self._items = items or [
            {
                "chunk_id": "c-tuition-1",
                "document_id": "doc-tuition-2026",
                "title": "Thông báo học phí VKU 2026",
                "text": "Học phí chương trình đại trà năm 2026 là 450.000đ đến 550.000đ mỗi tín chỉ.",
                "source_url": "https://vku.udn.vn/hoc-phi-2026",
                "page_or_section": "Mục 2",
                "category": "academic",
                "applicable_year": 2026,
                "document_version": "v1.0",
                "score": 0.91,
            },
            {
                "chunk_id": "c-adm-1",
                "document_id": "doc-adm-2026",
                "title": "Đề án tuyển sinh VKU 2026",
                "text": "VKU xét tuyển 5 phương thức tuyển sinh đại học chính quy.",
                "source_url": "https://vku.udn.vn/tuyen-sinh-2026",
                "page_or_section": "Mục III",
                "category": "admissions",
                "applicable_year": 2026,
                "document_version": "v2.0",
                "score": 0.87,
            },
        ]

    def search(self, query, top_k, category=None, applicable_year=None, document_id=None, hybrid=False):
        results = self._items
        if category:
            results = [r for r in results if r["category"] == category]
        if applicable_year is not None:
            results = [r for r in results if r["applicable_year"] == applicable_year]
        if document_id:
            results = [r for r in results if r["document_id"] == document_id]
        return results[:top_k]

    def list_documents(self):
        return [
            {
                "document_id": "doc-tuition-2026",
                "title": "Thông báo học phí VKU 2026",
                "category": "academic",
                "source_url": "https://vku.udn.vn/hoc-phi-2026",
                "applicable_year": 2026,
                "version": "v1.0",
                "status": "ready",
                "chunks_count": 1,
                "updated_at": "2026-01-10T00:00:00Z",
                "sections_preview": ["Mục 2"],
            },
            {
                "document_id": "doc-adm-2026",
                "title": "Đề án tuyển sinh VKU 2026",
                "category": "admissions",
                "source_url": "https://vku.udn.vn/tuyen-sinh-2026",
                "applicable_year": 2026,
                "version": "v2.0",
                "status": "ready",
                "chunks_count": 1,
                "updated_at": "2026-01-11T00:00:00Z",
                "sections_preview": ["Mục III"],
            },
        ]

    def get_document_chunks(self, document_id, limit=30):
        return [r for r in self._items if r["document_id"] == document_id][:limit]


def _parse_sse(raw_text: str) -> list[tuple[str, dict]]:
    events = []
    for block in raw_text.strip().split("\n\n"):
        if not block.strip():
            continue
        event_name = "message"
        data_obj = {}
        for line in block.splitlines():
            if line.startswith("event:"):
                event_name = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                data_obj = json.loads(line.split(":", 1)[1].strip())
        events.append((event_name, data_obj))
    return events


@pytest.mark.api
class TestLibraryAndStreamEndpoints:
    def test_condense_query_combines_short_followups(self):
        history = [
            HistoryTurn(role="user", content="Học phí ngành CNTT năm 2026 là bao nhiêu?"),
            HistoryTurn(role="assistant", content="Học phí khoảng 15-18 triệu."),
        ]
        condensed = condense_query("Còn chất lượng cao?", history)
        assert "Học phí ngành CNTT năm 2026" in condensed
        assert "Còn chất lượng cao?" in condensed

        standalone = "Hãy cho tôi biết đầy đủ các điều kiện xét tuyển thẳng vào trường năm 2026 là gì?"
        assert condense_query(standalone, history) == standalone

    def test_library_documents_and_search(self, tmp_path):
        settings = Settings(
            _env_file=None,
            app_env="production",
            db_path=tmp_path / "lib.db",
            retrieval_enabled=True,
            chat_enabled=False,
        )
        retriever = StubLibraryRetriever()
        app = create_app(settings=settings, retriever_factory=lambda _: retriever)
        with TestClient(app) as client:
            res = client.get("/api/library/documents")
            assert res.status_code == 200
            data = res.json()
            doc_ids = {d["document_id"] for d in data["documents"]}
            assert {"doc-tuition-2026", "doc-adm-2026"}.issubset(doc_ids)
            assert data["total"] == len(data["documents"])
            assert data["index_version"] == "lib-test-v1"

            filtered = client.get("/api/library/documents?category=admissions")
            assert filtered.status_code == 200
            assert all(d["category"] == "admissions" for d in filtered.json()["documents"])
            assert "doc-adm-2026" in {d["document_id"] for d in filtered.json()["documents"]}

            detail = client.get("/api/library/documents/doc-tuition-2026")
            assert detail.status_code == 200
            assert len(detail.json()["chunks"]) == 1

            missing = client.get("/api/library/documents/nonexistent")
            assert missing.status_code == 404

            search_res = client.post(
                "/api/library/search",
                json={"query": "học phí", "document_id": "doc-tuition-2026"},
            )
            assert search_res.status_code == 200
            assert len(search_res.json()["results"]) == 1
            assert search_res.json()["results"][0]["chunk_id"] == "c-tuition-1"

    def test_chat_stream_emits_meta_tokens_and_done(self, tmp_path):
        settings = Settings(
            _env_file=None,
            app_env="test",
            db_path=tmp_path / "stream.db",
            retrieval_enabled=True,
            chat_enabled=True,
            llm_provider="fake",
        )
        retriever = StubLibraryRetriever()
        app = create_app(settings=settings, retriever_factory=lambda _: retriever)
        with TestClient(app) as client:
            res = client.post(
                "/api/chat/stream",
                json={
                    "message": "Còn năm 2026?",
                    "category": "academic",
                    "document_id": "doc-tuition-2026",
                    "history": [{"role": "user", "content": "Học phí đại trà VKU"}],
                },
            )
            assert res.status_code == 200
            assert res.headers["content-type"].startswith("text/event-stream")
            events = _parse_sse(res.text)
            names = [name for name, _ in events]
            assert names[0] == "meta"
            assert "token" in names
            assert names[-1] == "done"

            meta = events[0][1]
            assert meta["status"] == "answered"
            assert len(meta["sources"]) == 1
            assert meta["sources"][0]["document_id"] == "doc-tuition-2026"
            assert meta["condensed_query"] is not None

            full_text = "".join(payload["delta"] for name, payload in events if name == "token")
            assert "FAKE" in full_text

    def test_hybrid_retriever_boosts_exact_vietnamese_terms(self):
        with tempfile.TemporaryDirectory() as tmp:
            index_dir = Path(tmp) / "indexes"
            settings = Settings(
                _env_file=None,
                data_dir=FIXTURES / "documents",
                index_dir=index_dir,
                retrieval_enabled=True,
                app_env="development",
            )
            embedder = _FakeEmbedder()
            build(settings, FIXTURES / "manifest.json", index_dir, embedder)
            retriever = Retriever(settings, embedder=embedder)

            docs = retriever.list_documents()
            assert len(docs) > 0
            doc_id = docs[0]["document_id"]
            chunks = retriever.get_document_chunks(doc_id)
            assert len(chunks) > 0

            hybrid_results = retriever.search("Tra cứu lịch học", 3, hybrid=True)
            assert len(hybrid_results) > 0
            assert "hybrid_score" in hybrid_results[0]

    def test_extractive_provider_answers_without_bedrock(self, tmp_path):
        settings = Settings(
            _env_file=None,
            app_env="production",
            db_path=tmp_path / "ext.db",
            retrieval_enabled=True,
            chat_enabled=True,
            llm_provider="extractive",
        )
        retriever = StubLibraryRetriever()
        app = create_app(settings=settings, retriever_factory=lambda _: retriever)
        with TestClient(app) as client:
            res = client.post("/api/chat", json={"message": "Học phí chương trình đại trà năm 2026?"})
            assert res.status_code == 200
            body = res.json()
            assert body["generation_mode"] == "extractive"
            assert body["status"] == "answered"
            assert "FAKE" not in body["answer"]
            assert "[S1]" in body["answer"]
            assert len(body["sources"]) >= 1
