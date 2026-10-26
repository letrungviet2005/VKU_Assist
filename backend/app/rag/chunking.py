import hashlib
import json

from app.rag.schemas import Chunk, Document


def prefixed(text: str, kind: str) -> str:
    prefix = f"{kind}: "
    # Accept already-prefixed input without accidentally duplicating an E5 prefix.
    while text.startswith(prefix):
        text = text[len(prefix):]
    return prefix + text


def make_chunks(doc: Document, sections, content_hash: str, indexed_at: str,
                tokenizer, size: int, overlap: int, model_limit: int) -> list[Chunk]:
    if size > model_limit or not 0 <= overlap < size:
        raise ValueError("Invalid chunk size/overlap for embedding model")
    chunks = []
    for section_index, (location, text) in enumerate(sections):
        # Fast tokenizer offsets let us slice the original Unicode text, rather than
        # decoding wordpieces (which can change Vietnamese or table formatting).
        offsets = tokenizer(text, add_special_tokens=False, return_offsets_mapping=True,
                            truncation=False, verbose=False)["offset_mapping"]
        start = 0
        while start < len(offsets):
            end = min(start + size, len(offsets))
            while end > start:
                piece = text[offsets[start][0]:offsets[end - 1][1]].strip()
                count = len(tokenizer(prefixed(piece, "passage"), add_special_tokens=True)["input_ids"])
                if count <= size:
                    break
                end -= 1
            if end <= start or end - start <= overlap and end < len(offsets):
                raise ValueError("Chunk budget leaves no progress after prefix, special tokens and overlap")
            identity = [doc.document_id, doc.document_version, content_hash, section_index, start, end]
            chunk_id = hashlib.sha256(json.dumps(identity, ensure_ascii=False).encode()).hexdigest()
            chunks.append(Chunk(
                chunk_id=chunk_id, document_id=doc.document_id, text=piece,
                title=doc.title, source_url=doc.source_url, page_or_section=location,
                category=doc.category, applicable_year=doc.applicable_year,
                document_version=doc.document_version, content_hash=content_hash, indexed_at=indexed_at,
            ))
            if end == len(offsets):
                break
            start = end - overlap
    return chunks
