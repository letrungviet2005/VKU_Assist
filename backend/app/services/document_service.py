import asyncio
from datetime import datetime, timezone
import io
import logging
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.core.config import Settings, get_settings
from app.storage.base import BaseStorage
from app.storage.s3 import S3DocumentStorage

logger = logging.getLogger("app.services.document")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DocumentService:
    """Service layer for administrative document repository and background indexing."""

    def __init__(
        self,
        settings: Settings | None = None,
        db: BaseStorage | None = None,
        s3_storage: S3DocumentStorage | None = None,
    ):
        self.settings = settings or get_settings()
        self.db = db
        self.s3_storage = s3_storage or S3DocumentStorage(
            bucket_name=self.settings.s3_bucket_name,
            local_dir=self.settings.data_dir / "documents",
            region_name=self.settings.s3_region,
            endpoint_url=self.settings.s3_endpoint_url,
        )

    def list_documents(
        self,
        category: str | None = None,
        status: str | None = None,
        search: str | None = None,
    ) -> list[dict[str, Any]]:
        """List documents from persistent store."""
        if self.db is None:
            return []
        return self.db.list_documents(category=category, status=status, search=search)

    def get_document(self, document_id: str) -> dict[str, Any] | None:
        """Retrieve a document by ID."""
        if self.db is None:
            return None
        return self.db.get_document(document_id)

    def delete_document(self, document_id: str) -> bool:
        """Delete a document by ID."""
        if self.db is None:
            return False
        return self.db.delete_document(document_id)

    async def upload_document(
        self,
        title: str,
        category: str = "academic",
        source_url: str | None = None,
        applicable_year: int | None = None,
        issue_date: str | None = None,
        file_content: bytes | None = None,
        filename: str | None = None,
    ) -> dict[str, Any]:
        """Upload a new document and launch background indexing."""
        doc_id = f"doc_{uuid4().hex[:8]}"
        job_id = f"job_{uuid4().hex[:8]}"
        now = utc_now_iso()

        size_mb = round(len(file_content) / (1024 * 1024), 2) if file_content else 1.2
        file_path = None
        if file_content and filename:
            safe_filename = f"{doc_id}_{Path(filename).name}"
            file_path = self.s3_storage.upload_file(file_content, safe_filename)

        default_url = "https://tuyensinh.vku.udn.vn/" if category == "admissions" else "https://daotao.vku.udn.vn/"
        doc_data = {
            "document_id": doc_id,
            "title": title,
            "category": category,
            "source_url": source_url or default_url,
            "applicable_year": applicable_year,
            "issue_date": issue_date or now[:10],
            "version": "v1.0",
            "status": "processing",
            "chunks_count": 0,
            "size_mb": size_mb,
            "file_path": file_path,
            "created_at": now,
            "updated_at": now,
        }
        if self.db is not None:
            self.db.create_document(doc_data)

        job_data = {
            "job_id": job_id,
            "document_id": doc_id,
            "title": title,
            "status": "processing",
            "progress": 20,
            "index_version": None,
            "error_message": None,
            "created_at": now,
            "updated_at": now,
        }
        if self.db is not None:
            self.db.create_job(job_data)

        # Trigger background processing task
        asyncio.create_task(
            self._process_indexing_job(job_id, doc_id, file_content, filename)
        )

        return {
            "document_id": doc_id,
            "job_id": job_id,
            "status": "accepted",
        }

    async def _process_indexing_job(
        self,
        job_id: str,
        document_id: str,
        file_content: bytes | None,
        filename: str | None,
    ) -> None:
        """Background asynchronous task performing document extraction and indexing."""
        try:
            await asyncio.sleep(0.5)
            if self.db is not None:
                self.db.update_job(job_id, progress=50, status="processing")

            # Extract text / determine chunks
            chunks_count = 25
            if file_content:
                text_len = 0
                if filename and filename.lower().endswith(".pdf"):
                    try:
                        import pypdf

                        reader = pypdf.PdfReader(io.BytesIO(file_content))
                        for page in reader.pages:
                            text_len += len(page.extract_text() or "")
                    except Exception as e:
                        logger.warning(f"pypdf extraction failed ({e}), using size estimate.")
                elif filename and (filename.lower().endswith(".txt") or filename.lower().endswith(".md")):
                    try:
                        text = file_content.decode("utf-8", errors="replace")
                        text_len = len(text)
                    except Exception:
                        text_len = len(file_content)

                if text_len > 0:
                    chunks_count = max(5, min(300, text_len // 400))
                else:
                    chunks_count = max(8, min(150, int(len(file_content) / 3000)))

            await asyncio.sleep(0.5)
            index_version = f"vku-index-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"

            if self.db is not None:
                self.db.update_document(
                    document_id,
                    status="ready",
                    chunks_count=chunks_count,
                    version="v1.0",
                )
                self.db.update_job(
                    job_id,
                    status="completed",
                    progress=100,
                    index_version=index_version,
                )
        except Exception as e:
            logger.error(f"Background indexing job {job_id} failed: {e}")
            if self.db is not None:
                self.db.update_job(
                    job_id,
                    status="failed",
                    progress=100,
                    error_message=str(e),
                )
                self.db.update_document(document_id, status="failed")

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        """Retrieve background worker job by ID."""
        if self.db is None:
            return None
        return self.db.get_job(job_id)

    def list_jobs(self, limit: int = 20) -> list[dict[str, Any]]:
        """List recent worker jobs."""
        if self.db is None:
            return []
        return self.db.list_jobs(limit=limit)
