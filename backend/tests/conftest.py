"""Pytest fixtures and configuration for VKU Assist test suite.

Employs standard Clean Code patterns and pytest fixtures for:
- Settings and Environment configuration
- In-memory SQLite Database isolation and teardown
- Stub / Fake Embedders and Retrievers
- FastAPI TestClient instances
"""
import hashlib
import json
from pathlib import Path
import re
from typing import Any, Generator
from unittest.mock import Mock

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.llm.client import FakeAdapter, Generation
from app.main import create_app
from app.rag.chunking import prefixed
from app.storage.database import Database

FIXTURES_DIR = Path(__file__).parent / "fixtures"


# ---------------------------------------------------------------------------
# Embedder and Retriever Fakes
# ---------------------------------------------------------------------------

class FakeTokenizer:
    """Deterministic tokenizer matching whitespace tokens for fast testing."""

    def __call__(self, text: str, add_special_tokens: bool = True, return_offsets_mapping: bool = False, **kwargs):
        offsets = [(m.start(), m.end()) for m in re.finditer(r"\S+", text)]
        result = {"input_ids": list(range(len(offsets) + (2 if add_special_tokens else 0)))}
        if return_offsets_mapping:
            result["offset_mapping"] = offsets
        return result


class FakeEmbedder:
    """Fake 8-dimensional embedder generating deterministic normalized vectors."""

    tokenizer = FakeTokenizer()
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

    def encode(self, texts: list[str], kind: str) -> np.ndarray:
        vectors = np.array(
            [list(hashlib.sha256(prefixed(t, kind).encode("utf-8")).digest()[:8]) for t in texts],
            dtype="float32",
        ) + 1.0
        return vectors / np.linalg.norm(vectors, axis=1, keepdims=True)


def make_chunk_data(number: int = 1, **updates) -> dict[str, Any]:
    """Helper factory for predictable chunk dictionaries."""
    data = {
        "chunk_id": f"chunk-{number}",
        "document_id": f"doc-{number}",
        "title": "Tài liệu học vụ VKU (Chính thức)",
        "text": f"Nội dung quy chế đào tạo và học bổng điều {number}.",
        "source_url": "https://vku.udn.vn/quy-che-dao-tao",
        "page_or_section": f"Điều {number}",
        "category": "academic",
        "applicable_year": 2026,
        "document_version": "vku-2026-v1",
    }
    data.update(updates)
    return data


class StubRetriever:
    """Retriever stub with configurable results and immutable version snapshot."""

    version = "vku-test-snapshot-2026"

    def __init__(self, results: list[dict[str, Any]] | None = None):
        if results is None:
            results = [make_chunk_data(1)]
        self.search = Mock(return_value=results)


# ---------------------------------------------------------------------------
# Pytest Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def test_settings() -> Settings:
    """Provide isolated test settings with in-memory DB and fake providers."""
    return Settings(
        _env_file=None,
        app_name="VKU Assist Test",
        app_env="test",
        db_path=":memory:",
        retrieval_enabled=True,
        chat_enabled=True,
        llm_provider="fake",
        chat_max_concurrency=2,
    )


@pytest.fixture
def in_memory_db() -> Generator[Database, None, None]:
    """Provide a fresh in-memory SQLite database instance with clean teardown."""
    db = Database(db_path=":memory:")
    yield db
    db.close()


@pytest.fixture
def fake_embedder() -> FakeEmbedder:
    """Provide a fake embedder instance."""
    return FakeEmbedder()


@pytest.fixture
def stub_retriever() -> StubRetriever:
    """Provide a stub retriever instance with default test chunk."""
    return StubRetriever()


@pytest.fixture
def app(test_settings: Settings, stub_retriever: StubRetriever):
    """Provide a FastAPI application instance wired with test settings and stub retriever."""
    application = create_app(
        settings=test_settings,
        retriever_factory=lambda _: stub_retriever,
        adapter_factory=lambda s: FakeAdapter(s),
    )
    return application


@pytest.fixture
def client(app) -> Generator[TestClient, None, None]:
    """Provide a TestClient with proper lifecycle context."""
    with TestClient(app) as test_client:
        yield test_client
    if hasattr(app.state, "db") and app.state.db:
        app.state.db.close()


@pytest.fixture
def sample_session(client: TestClient) -> dict[str, Any]:
    """Create a sample chat session with 2 messages (1 user, 1 assistant with source)."""
    create_res = client.post(
        "/api/sessions",
        json={"title": "Tra cứu quy chế đào tạo tín chỉ VKU", "session_token": "tok_student_vku"},
    )
    assert create_res.status_code == 201
    session = create_res.json()
    session_id = session["id"]

    # Add user message
    client.post(
        f"/api/sessions/{session_id}/messages",
        json={
            "role": "user",
            "content": "Điều kiện xét học bổng khuyến khích là gì?",
        },
    )

    # Add assistant message with citations
    sources = [
        {
            "source_id": "S1",
            "chunk_id": "chunk-101",
            "document_id": "doc-hocbong-2026",
            "title": "Quy định Học bổng VKU 2026",
            "url": "https://vku.udn.vn/hoc-bong",
            "page_or_section": "Điều 5",
            "applicable_year": 2026,
            "document_version": "v1.0",
        }
    ]
    client.post(
        f"/api/sessions/{session_id}/messages",
        json={
            "role": "assistant",
            "content": "Sinh viên cần đạt điểm rèn luyện tốt và GPA từ 3.2 trở lên [S1].",
            "status": "answered",
            "sources": sources,
            "index_version": "vku-2026-v1",
            "generation_mode": "fake",
        },
    )

    detail_res = client.get(f"/api/sessions/{session_id}")
    return detail_res.json()
