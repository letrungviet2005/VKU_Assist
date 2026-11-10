import inspect
import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, Request, status
from pydantic import ValidationError

from app.core.errors import ServiceError
from app.core.security import get_current_admin
from app.schemas.document import (
    DocumentDeleteResponse,
    DocumentItem,
    DocumentUploadRequest,
    DocumentUploadResponse,
    JobStatusResponse,
)
from app.services.document_service import DocumentService

router = APIRouter(prefix="/api/admin", tags=["admin-documents"])


def get_doc_service(request: Request) -> DocumentService:
    service = getattr(request.app.state, "document_service", None)
    if service is None:
        service = DocumentService(
            settings=getattr(request.app.state, "settings", None),
            db=getattr(request.app.state, "db", None),
        )
        request.app.state.document_service = service
    return service


@router.get("/documents", response_model=list[DocumentItem])
async def list_documents(
    request: Request,
    category: str | None = None,
    status: str | None = None,
    search: str | None = None,
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """Retrieve all documents in the VKU Assist knowledge base."""
    service = get_doc_service(request)
    docs = service.list_documents(category=category, status=status, search=search)
    return docs


@router.get("/documents/{document_id}", response_model=DocumentItem)
async def get_document(
    document_id: str,
    request: Request,
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """Get single document details by ID."""
    service = get_doc_service(request)
    doc = service.get_document(document_id)
    if not doc:
        raise ServiceError(404, "document_not_found", f"Không tìm thấy tài liệu {document_id}")
    return doc


@router.post("/documents", response_model=DocumentUploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    request: Request,
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """Upload a new official document (PDF, TXT, MD, DOCX) and trigger background indexing."""
    service = get_doc_service(request)
    content_type = request.headers.get("content-type", "")

    file_content = None
    filename = None
    title = ""
    category = "academic"
    source_url = None
    applicable_year = None
    issue_date = None

    if "multipart/form-data" in content_type:
        form = await request.form()
        title = str(form.get("title") or "").strip()
        if not title:
            raise ServiceError(422, "invalid_request", "Tiêu đề tài liệu là bắt buộc.")
        if len(title) > 300:
            raise ServiceError(422, "invalid_request", "Tiêu đề tài liệu không được vượt quá 300 ký tự.")

        raw_cat = form.get("category")
        if raw_cat is None:
            category = "academic"
        else:
            category = str(raw_cat).strip()
            if category not in {"academic", "admissions"}:
                raise ServiceError(422, "invalid_request", "Danh mục phải là 'academic' hoặc 'admissions'.")

        source_url = str(form.get("source_url")).strip() if form.get("source_url") else None
        
        raw_year = form.get("applicable_year")
        if raw_year is not None and str(raw_year).strip():
            try:
                applicable_year = int(str(raw_year).strip())
                if applicable_year < 1900 or applicable_year > 2200:
                    raise ServiceError(422, "invalid_request", "Năm áp dụng phải nằm trong khoảng từ 1900 đến 2200.")
            except ValueError:
                raise ServiceError(422, "invalid_request", "Năm áp dụng phải là số nguyên hợp lệ.")

        issue_date = str(form.get("issue_date")).strip() if form.get("issue_date") else None

        file_obj = form.get("file")
        if file_obj and hasattr(file_obj, "read"):
            filename = getattr(file_obj, "filename", "document.pdf")
            ext = Path(filename).suffix.lower()
            allowed_exts = {".pdf", ".txt", ".md", ".docx"}
            if ext and ext not in allowed_exts:
                raise ServiceError(422, "invalid_file_format", f"Định dạng tệp '{ext}' không được hỗ trợ. Chỉ chấp nhận PDF, TXT, MD, DOCX.")
            read_fn = getattr(file_obj, "read", None)
            if callable(read_fn):
                read_res = read_fn()
                file_content = await read_res if inspect.isawaitable(read_res) else read_res
            if file_content and len(file_content) > 15 * 1024 * 1024:
                raise ServiceError(413, "payload_too_large", "Dung lượng tệp vượt quá giới hạn tối đa 15MB.")
    else:
        try:
            body = await request.json()
            payload = DocumentUploadRequest(**body)
            title = payload.title.strip()
            if not title:
                raise ServiceError(422, "invalid_request", "Tiêu đề tài liệu không được rỗng.")
            category = payload.category
            source_url = payload.source_url
            applicable_year = payload.applicable_year
            issue_date = payload.issue_date
        except (json.JSONDecodeError, ValidationError) as e:
            raise ServiceError(422, "invalid_request", "Dữ liệu JSON không hợp lệ.")

    res = await service.upload_document(
        title=title,
        category=category,
        source_url=source_url,
        applicable_year=applicable_year,
        issue_date=issue_date,
        file_content=file_content,
        filename=filename,
    )
    return DocumentUploadResponse(**res)


@router.delete("/documents/{document_id}", response_model=DocumentDeleteResponse)
async def delete_document(
    document_id: str,
    request: Request,
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """Delete a document from knowledge base registry."""
    service = get_doc_service(request)
    doc = service.get_document(document_id)
    if not doc:
        raise ServiceError(404, "document_not_found", f"Tài liệu {document_id} không tồn tại.")

    service.delete_document(document_id)
    return DocumentDeleteResponse(status="deleted", document_id=document_id)


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_indexing_job(
    job_id: str,
    request: Request,
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """Get status and progress of a background indexing job."""
    service = get_doc_service(request)
    job = service.get_job(job_id)
    if not job:
        raise ServiceError(404, "job_not_found", f"Không tìm thấy tiến trình xử lý {job_id}")
    return job


@router.get("/jobs", response_model=list[JobStatusResponse])
async def list_indexing_jobs(
    request: Request,
    limit: int = 20,
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """List recent background indexing jobs."""
    service = get_doc_service(request)
    jobs = service.list_jobs(limit=min(100, max(1, limit)))
    return jobs
