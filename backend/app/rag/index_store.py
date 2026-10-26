"""Immutable bundles and an atomically replaced active.json pointer. No pickle."""
import hashlib
import json
import os
from pathlib import Path
import re
from uuid import uuid4

from app.rag.schemas import Chunk, Document


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, value) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as file:
        json.dump(value, file, ensure_ascii=False, indent=2, allow_nan=False)
        file.flush()
        os.fsync(file.fileno())


def chunk_config(settings):
    return {"size": settings.chunk_size, "overlap": settings.chunk_overlap,
            "algorithm": "offset-windows-v1"}


def load_bundle(root: Path, version: str | None = None, expected_model=None, expected_chunking=None):
    import faiss
    import numpy as np

    root = root.resolve(strict=True)
    pointer = None
    if version is None:
        pointer = json.loads((root / "active.json").read_text(encoding="utf-8"))
        version = pointer["index_version"]
    if not isinstance(version, str) or not re.fullmatch(r"[a-f0-9]{32}", version):
        raise ValueError("Invalid index version pointer")
    bundle = (root / version).resolve(strict=True)
    if not bundle.is_relative_to(root):
        raise ValueError("Bundle escapes trusted index directory")
    if pointer is not None and sha256(bundle / "manifest.json") != pointer.get("manifest_sha256"):
        raise ValueError("Index manifest checksum failed")
    manifest = json.loads((bundle / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("schema_version") != 1 or manifest.get("index_version") != version:
        raise ValueError("Unsupported or mismatched index manifest")
    if expected_model is not None and manifest["embedding"] != expected_model:
        raise ValueError("Embedding model/revision/configuration differs from index")
    if expected_chunking is not None and manifest["chunking"] != expected_chunking:
        raise ValueError("Chunking configuration differs from index")
    if set(manifest["checksums"]) != {"vectors.faiss", "chunks.json"}:
        raise ValueError("Incomplete bundle checksum manifest")
    for name, checksum in manifest["checksums"].items():
        file = (bundle / name).resolve(strict=True)
        if not file.is_relative_to(bundle) or sha256(file) != checksum:
            raise ValueError(f"Bundle checksum/path failed: {name}")
    chunks = [Chunk.model_validate(item) for item in json.loads((bundle / "chunks.json").read_text(encoding="utf-8"))]
    documents = {}
    for entry in manifest["documents"]:
        doc = Document.model_validate({key: entry[key] for key in Document.model_fields})
        if doc.document_id in documents:
            raise ValueError("Duplicate source mapping")
        documents[doc.document_id] = entry
    for chunk in chunks:
        source = documents.get(chunk.document_id)
        if source is None or any(chunk.model_dump(mode="json")[key] != source[key] for key in (
            "title", "source_url", "category", "applicable_year", "document_version", "content_hash", "indexed_at",
        )):
            raise ValueError("Invalid chunk source mapping")
    index = faiss.read_index(str(bundle / "vectors.faiss"))
    if (not isinstance(index, faiss.IndexFlatIP) or index.ntotal != len(chunks)
            or index.ntotal != manifest["chunk_count"] or not chunks
            or index.d != manifest["embedding"]["dimension"]
            or len({c.chunk_id for c in chunks}) != len(chunks)):
        raise ValueError("Invalid vector/chunk mapping")
    vectors = index.reconstruct_n(0, index.ntotal)
    if not np.isfinite(vectors).all() or not np.allclose(np.linalg.norm(vectors, axis=1), 1, atol=1e-4):
        raise ValueError("Index vectors must be finite and normalized")
    return manifest, chunks, index


def publish(root: Path, chunks: list[Chunk], vectors, embedding: dict, chunking: dict, documents: list) -> str:
    import faiss
    import numpy as np

    if not chunks or vectors.shape != (len(chunks), embedding["dimension"]):
        raise ValueError("Cannot publish empty or mismatched vectors")
    root.mkdir(parents=True, exist_ok=True)
    version = uuid4().hex
    bundle = root / version
    bundle.mkdir()
    # Failed versions may remain for diagnosis but are never made active.
    index = faiss.IndexFlatIP(embedding["dimension"])
    index.add(np.ascontiguousarray(vectors, dtype="float32"))
    faiss.write_index(index, str(bundle / "vectors.faiss"))
    write_json(bundle / "chunks.json", [c.model_dump(mode="json") for c in chunks])
    manifest = {"schema_version": 1, "index_version": version,
                "indexed_at": chunks[0].indexed_at, "embedding": embedding,
                "chunking": chunking, "chunk_count": len(chunks), "documents": documents,
                "checksums": {name: sha256(bundle / name) for name in ("vectors.faiss", "chunks.json")}}
    write_json(bundle / "manifest.json", manifest)
    load_bundle(root, version, embedding, chunking)
    pointer = root / f".active-{uuid4().hex}.tmp"
    try:
        write_json(pointer, {"index_version": version, "manifest_sha256": sha256(bundle / "manifest.json")})
        os.replace(pointer, root / "active.json")
    finally:
        pointer.unlink(missing_ok=True)
    return version
