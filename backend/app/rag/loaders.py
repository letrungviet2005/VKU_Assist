"""Local text extraction. PDF page numbers are file pages, starting at one."""
import hashlib
import json
import re
from pathlib import Path

from pydantic import TypeAdapter

from app.rag.schemas import Document


def read_manifest(path: Path, data_dir: Path) -> list[tuple[Document, Path]]:
    documents = TypeAdapter(list[Document]).validate_python(json.loads(path.read_text(encoding="utf-8")))
    if not documents:
        raise ValueError("Manifest has no documents")
    root = data_dir.resolve(strict=True)
    seen = set()
    result = []
    for doc in documents:
        if doc.document_id in seen:
            raise ValueError(f"Duplicate document_id: {doc.document_id}")
        seen.add(doc.document_id)
        relative = Path(doc.file)
        if relative.is_absolute():
            raise ValueError("Manifest paths must be relative to DATA_DIR")
        file = (root / relative).resolve(strict=True)
        if not file.is_relative_to(root) or not file.is_file():
            raise ValueError("Document path escapes DATA_DIR or is not a file")
        if file.suffix.lower() not in {".pdf", ".txt", ".md"}:
            raise ValueError(f"Unsupported document type: {file.suffix}")
        result.append((doc, file))
    return result


def normalize(text: str) -> str:
    # Preserve newlines (including table rows) and Vietnamese Unicode characters.
    return "\n".join(re.sub(r"[^\S\n]+", " ", line).strip() for line in text.splitlines()).strip()


def extract(file: Path) -> tuple[str, list[tuple[int | str | None, str]]]:
    content_hash = hashlib.sha256(file.read_bytes()).hexdigest()
    if file.suffix.lower() == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(file)
        if reader.is_encrypted:
            raise ValueError("Encrypted PDF is unsupported")
        sections = []
        for number, page in enumerate(reader.pages, start=1):
            text = normalize(page.extract_text(extraction_mode="layout") or "") if "/Contents" in page else ""
            if not text:
                raise ValueError(f"PDF page {number} has no extractable text; OCR is not supported")
            sections.append((number, text))
    else:
        text = file.read_text(encoding="utf-8-sig")
        sections = []
        if file.suffix.lower() == ".md":
            heading = None
            lines = []
            in_fence = False
            for line in text.splitlines():
                if line.lstrip().startswith(("```", "~~~")):
                    in_fence = not in_fence
                match = None if in_fence else re.match(r"^#{1,6}\s+(.+?)\s*#*\s*$", line)
                if match:
                    if normalize("\n".join(lines)):
                        sections.append((heading, normalize("\n".join(lines))))
                    heading, lines = match.group(1), [line]
                else:
                    lines.append(line)
            if normalize("\n".join(lines)):
                sections.append((heading, normalize("\n".join(lines))))
        else:
            sections = [(None, normalize(text))]
    if not sections or not any(text for _, text in sections):
        raise ValueError(f"Document has no extractable text: {file.name}")
    return content_hash, sections
