import argparse
from datetime import datetime, timezone
from pathlib import Path
import sys

from app.core.config import get_settings
from app.rag.chunking import make_chunks
from app.rag.embeddings import Embedder
from app.rag.index_store import chunk_config, publish
from app.rag.loaders import extract, read_manifest


def build(settings, manifest: Path, output: Path, embedder=None):
    documents = read_manifest(manifest, settings.data_dir)
    # Validate/extract every source before loading a model or touching the active pointer.
    extracted = [(doc, *extract(path)) for doc, path in documents]
    model = embedder if embedder is not None else Embedder(settings)
    indexed_at = datetime.now(timezone.utc).isoformat()
    chunks, metadata = [], []
    for doc, content_hash, sections in extracted:
        parts = make_chunks(doc, sections, content_hash, indexed_at, model.tokenizer,
                            settings.chunk_size, settings.chunk_overlap, model.limit)
        if not parts:
            raise ValueError(f"No valid chunks: {doc.document_id}")
        chunks.extend(parts)
        metadata.append({**doc.model_dump(mode="json"), "content_hash": content_hash,
                         "indexed_at": indexed_at, "chunk_count": len(parts)})
    vectors = model.encode([chunk.text for chunk in chunks], "passage")
    version = publish(output, chunks, vectors, model.identity, chunk_config(settings), metadata)
    return {"documents": len(documents), "chunks": len(chunks), "index_version": version}


def main():
    parser = argparse.ArgumentParser(description="Build an immutable local retrieval index; no model downloads")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--data-dir", type=Path)
    parser.add_argument("--chunk-size", type=int)
    parser.add_argument("--overlap", type=int)
    args = parser.parse_args()
    try:
        from app.core.config import Settings

        values = get_settings().model_dump()
        for key, value in (("data_dir", args.data_dir), ("chunk_size", args.chunk_size), ("chunk_overlap", args.overlap)):
            if value is not None:
                values[key] = value
        result = build(Settings(**values), args.manifest, args.output)
        print(result)
    except Exception as error:
        print(f"Indexing failed: {type(error).__name__}: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
