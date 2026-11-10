import inspect
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.errors import ErrorEnvelope, ServiceError
from app.rag.schemas import Category

router = APIRouter(prefix="/api/library", tags=["library"], responses={
    status: {"model": ErrorEnvelope} for status in (404, 422, 503)
})


class LibrarySearchInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query: str = Field(min_length=1, max_length=2000)
    top_k: int | None = Field(default=6, ge=1, le=12)
    category: Category | None = None
    applicable_year: int | None = Field(default=None, ge=1900, le=2200)
    document_id: str | None = Field(default=None, max_length=120)

    @field_validator("query")
    @classmethod
    def nonblank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("query must not be blank")
        return value


@router.get("/documents")
def list_public_documents(
    request: Request,
    category: str | None = Query(default=None),
    applicable_year: int | None = Query(default=None, ge=1900, le=2200),
    search: str | None = Query(default=None),
):
    """Public read-only catalog of ready documents from DB and loaded FAISS bundle."""
    state = request.app.state
    merged: dict[str, dict] = {}

    retriever = getattr(state, "retriever", None)
    if retriever is not None and hasattr(retriever, "list_documents"):
        for doc in retriever.list_documents():
            merged[doc["document_id"]] = doc

    db = getattr(state, "db", None)
    if db is not None:
        for doc in db.list_documents(category=None, status="ready", search=None):
            doc_id = doc["document_id"]
            existing = merged.get(doc_id)
            if existing:
                existing["issue_date"] = doc.get("issue_date")
                existing["size_mb"] = doc.get("size_mb", 0.0)
            else:
                merged[doc_id] = {
                    "document_id": doc_id,
                    "title": doc["title"],
                    "category": doc["category"],
                    "source_url": doc.get("source_url"),
                    "applicable_year": doc.get("applicable_year"),
                    "issue_date": doc.get("issue_date"),
                    "version": doc.get("version", "v1.0"),
                    "status": doc.get("status", "ready"),
                    "chunks_count": doc.get("chunks_count", 0),
                    "size_mb": doc.get("size_mb", 0.0),
                    "updated_at": doc.get("updated_at"),
                    "sections_preview": [],
                }

    items = list(merged.values())
    if category:
        items = [d for d in items if d.get("category") == category]
    if applicable_year is not None:
        items = [d for d in items if d.get("applicable_year") == applicable_year]
    if search and search.strip():
        needle = search.strip().lower()
        items = [d for d in items if needle in (d.get("title") or "").lower()]

    return {
        "index_version": getattr(retriever, "version", None),
        "total": len(items),
        "documents": items,
    }


@router.get("/documents/{document_id}")
def get_public_document_detail(document_id: str, request: Request):
    """Return metadata and indexed chunk previews for a specific public document."""
    state = request.app.state
    retriever = getattr(state, "retriever", None)
    db = getattr(state, "db", None)

    doc_meta = None
    chunks = []
    if retriever is not None and hasattr(retriever, "list_documents"):
        for d in retriever.list_documents():
            if d["document_id"] == document_id:
                doc_meta = d
                break
        if hasattr(retriever, "get_document_chunks"):
            chunks = retriever.get_document_chunks(document_id, limit=30)

    if db is not None:
        db_doc = db.get_document(document_id)
        if db_doc and db_doc.get("status") == "ready":
            if doc_meta is None:
                doc_meta = db_doc
            else:
                doc_meta["issue_date"] = db_doc.get("issue_date")
                doc_meta["size_mb"] = db_doc.get("size_mb", 0.0)

    if doc_meta is None:
        raise ServiceError(404, "document_not_found", f"Không tìm thấy tài liệu '{document_id}'.")

    return {"document": doc_meta, "chunks": chunks}


@router.post("/search")
def library_search(body: LibrarySearchInput, request: Request):
    """Hybrid semantic + lexical chunk search across official VKU documents."""
    state = request.app.state
    retriever = getattr(state, "retriever", None)
    if retriever is None:
        raise ServiceError(503, getattr(state, "retrieval_reason", "retrieval_unavailable"), "Hệ thống truy xuất chưa sẵn sàng.")

    top_k = body.top_k or state.settings.search_top_k
    sig = inspect.signature(retriever.search)
    kwargs = {}
    if "document_id" in sig.parameters and body.document_id:
        kwargs["document_id"] = body.document_id
    if "hybrid" in sig.parameters:
        kwargs["hybrid"] = True

    try:
        results = retriever.search(body.query, top_k, body.category, body.applicable_year, **kwargs)
    except ValueError:
        raise ServiceError(422, "query_exceeds_model_token_limit", "Truy vấn vượt giới hạn token của model.") from None

    return {
        "query": body.query,
        "index_version": getattr(retriever, "version", "unknown"),
        "request_id": request.state.request_id,
        "results": results,
    }
