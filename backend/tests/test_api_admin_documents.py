import asyncio
import io
import pytest
from starlette.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.storage.database import Database


@pytest.fixture
def test_client(tmp_path):
    db_file = tmp_path / "test_admin.db"
    settings = Settings(
        app_name="VKU Assist Test",
        app_env="development",
        db_path=db_file,
        retrieval_enabled=False,
        chat_enabled=False,
        admin_username="admin",
        admin_password="vku2026",
    )
    application = create_app(settings=settings)
    with TestClient(application) as client:
        yield client, settings


class TestAdminAuthentication:
    """Verify administrator login and JWT issuance."""

    def test_admin_login_success(self, test_client):
        client, _ = test_client
        res = client.post(
            "/api/admin/login",
            json={"username": "admin", "password": "vku2026"},
        )
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert isinstance(data["expires_at"], int)
        assert data["expires_at"] > 0

    def test_admin_login_rejects_wrong_credentials(self, test_client):
        client, _ = test_client
        res = client.post(
            "/api/admin/login",
            json={"username": "admin", "password": "wrong_password_xyz"},
        )
        assert res.status_code == 401
        data = res.json()
        assert "error" in data
        assert data["error"]["code"] == "invalid_credentials"

    def test_admin_login_rejects_missing_fields(self, test_client):
        client, _ = test_client
        res = client.post("/api/admin/login", json={"username": "admin"})
        assert res.status_code == 422
        assert res.json()["error"]["code"] == "invalid_request"


class TestAdminDocumentsCRUD:
    """Verify document listing, searching, uploading, and deleting."""

    @pytest.fixture
    def auth_headers(self, test_client):
        client, _ = test_client
        res = client.post(
            "/api/admin/login",
            json={"username": "admin", "password": "vku2026"},
        )
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def test_list_documents_requires_auth(self, test_client):
        client, _ = test_client
        res = client.get("/api/admin/documents")
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "unauthorized"

    def test_list_seeded_documents(self, test_client, auth_headers):
        client, _ = test_client
        res = client.get("/api/admin/documents", headers=auth_headers)
        assert res.status_code == 200
        docs = res.json()
        assert isinstance(docs, list)
        assert len(docs) >= 5
        doc_ids = [d["document_id"] for d in docs]
        assert "doc-vku-admissions-2026" in doc_ids
        assert "doc-vku-academic-regs-2025" in doc_ids

    def test_filter_documents_by_category_and_search(self, test_client, auth_headers):
        client, _ = test_client
        # Filter category admissions
        res = client.get("/api/admin/documents?category=admissions", headers=auth_headers)
        assert res.status_code == 200
        docs = res.json()
        assert all(d["category"] == "admissions" for d in docs)

        # Search query
        res_search = client.get("/api/admin/documents?search=học bổng", headers=auth_headers)
        assert res_search.status_code == 200
        search_docs = res_search.json()
        assert len(search_docs) >= 1
        assert "học bổng" in search_docs[0]["title"].lower()

    def test_upload_document_json(self, test_client, auth_headers):
        client, _ = test_client
        payload = {
            "title": "Nghị quyết hội đồng trường về học phí 2026 - 2027",
            "category": "academic",
            "source_url": "https://vku.udn.vn/nghi-quyet-hoc-phi",
            "applicable_year": 2026,
            "issue_date": "2026-03-01",
        }
        res = client.post("/api/admin/documents", json=payload, headers=auth_headers)
        assert res.status_code == 202
        data = res.json()
        assert "document_id" in data
        assert "job_id" in data
        assert data["status"] == "accepted"

        # Verify document is retrieved
        doc_res = client.get(f"/api/admin/documents/{data['document_id']}", headers=auth_headers)
        assert doc_res.status_code == 200
        doc = doc_res.json()
        assert doc["title"] == payload["title"]
        assert doc["category"] == "academic"
        assert doc["applicable_year"] == 2026

    def test_upload_document_multipart_form(self, test_client, auth_headers):
        client, _ = test_client
        dummy_pdf_content = b"%PDF-1.4 sample content for VKU Assist test"
        files = {
            "file": ("de_an_2026.pdf", io.BytesIO(dummy_pdf_content), "application/pdf"),
        }
        data = {
            "title": "Đề án tuyển sinh sửa đổi bổ sung 2026",
            "category": "admissions",
            "applicable_year": "2026",
            "source_url": "https://vku.udn.vn/tuyen-sinh/bo-sung-2026",
        }
        res = client.post("/api/admin/documents", data=data, files=files, headers=auth_headers)
        assert res.status_code == 202
        resp_data = res.json()
        assert "document_id" in resp_data
        assert "job_id" in resp_data

        # Verify job was created
        job_res = client.get(f"/api/admin/jobs/{resp_data['job_id']}", headers=auth_headers)
        assert job_res.status_code == 200
        job = job_res.json()
        assert job["document_id"] == resp_data["document_id"]
        assert job["title"] == data["title"]

    def test_delete_document(self, test_client, auth_headers):
        client, _ = test_client
        # Delete existing document
        res = client.delete("/api/admin/documents/doc-vku-tuition-fee-2026", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["status"] == "deleted"

        # Verify 404 when getting deleted document
        get_res = client.get("/api/admin/documents/doc-vku-tuition-fee-2026", headers=auth_headers)
        assert get_res.status_code == 404
        assert get_res.json()["error"]["code"] == "document_not_found"

        # Deleting non-existent document returns 404
        del_again = client.delete("/api/admin/documents/non_existent_id", headers=auth_headers)
        assert del_again.status_code == 404

    def test_mock_frontend_token_accepted(self, test_client):
        client, _ = test_client
        mock_headers = {"Authorization": "Bearer admin_jwt_mocktoken123"}
        res = client.get("/api/admin/documents", headers=mock_headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_list_jobs_endpoint(self, test_client, auth_headers):
        client, _ = test_client
        res = client.get("/api/admin/jobs", headers=auth_headers)
        assert res.status_code == 200
        jobs = res.json()
        assert isinstance(jobs, list)

    def test_upload_file_size_exceeds_15mb_returns_413(self, test_client, auth_headers):
        client, _ = test_client
        # 15MB + 1KB dummy content
        oversized_content = b"x" * (15 * 1024 * 1024 + 1024)
        files = {
            "file": ("huge_document.pdf", io.BytesIO(oversized_content), "application/pdf"),
        }
        data = {
            "title": "Tài liệu dung lượng siêu lớn vượt ngưỡng 15MB",
            "category": "academic",
        }
        res = client.post("/api/admin/documents", data=data, files=files, headers=auth_headers)
        assert res.status_code == 413
        err = res.json()["error"]
        assert err["code"] == "payload_too_large"
        assert res.headers.get("X-Request-ID") == err["request_id"]

    def test_upload_unsupported_file_extension_returns_422(self, test_client, auth_headers):
        client, _ = test_client
        files = {
            "file": ("exploit.exe", io.BytesIO(b"binary payload"), "application/octet-stream"),
        }
        data = {
            "title": "Tệp thực thi không được hỗ trợ",
            "category": "academic",
        }
        res = client.post("/api/admin/documents", data=data, files=files, headers=auth_headers)
        assert res.status_code == 422
        err = res.json()["error"]
        assert err["code"] == "invalid_file_format"
        assert "không được hỗ trợ" in err["message"]

    @pytest.mark.parametrize("invalid_category", ["finance", "scholarship", "administrative", "123", ""])
    def test_upload_invalid_category_rejected_both_modes(self, test_client, auth_headers, invalid_category):
        client, _ = test_client
        # 1. JSON mode
        json_payload = {
            "title": "Tài liệu kiểm thử danh mục sai",
            "category": invalid_category,
        }
        res_json = client.post("/api/admin/documents", json=json_payload, headers=auth_headers)
        assert res_json.status_code == 422
        assert res_json.json()["error"]["code"] == "invalid_request"

        # 2. Multipart form mode
        files = {
            "file": ("doc.txt", io.BytesIO(b"Sample content"), "text/plain"),
        }
        form_data = {
            "title": "Tài liệu kiểm thử danh mục sai multipart",
            "category": invalid_category,
        }
        res_form = client.post("/api/admin/documents", data=form_data, files=files, headers=auth_headers)
        assert res_form.status_code == 422
        assert res_form.json()["error"]["code"] == "invalid_request"

    @pytest.mark.parametrize("invalid_year", [1899, 2201, -1, 0])
    def test_upload_out_of_range_year_rejected_both_modes(self, test_client, auth_headers, invalid_year):
        client, _ = test_client
        # 1. JSON mode
        json_payload = {
            "title": "Tài liệu kiểm thử năm sai",
            "applicable_year": invalid_year,
        }
        res_json = client.post("/api/admin/documents", json=json_payload, headers=auth_headers)
        assert res_json.status_code == 422
        assert res_json.json()["error"]["code"] == "invalid_request"

        # 2. Multipart mode
        files = {
            "file": ("doc.txt", io.BytesIO(b"Sample content"), "text/plain"),
        }
        form_data = {
            "title": "Tài liệu kiểm thử năm sai multipart",
            "applicable_year": str(invalid_year),
        }
        res_form = client.post("/api/admin/documents", data=form_data, files=files, headers=auth_headers)
        assert res_form.status_code == 422
        assert res_form.json()["error"]["code"] == "invalid_request"

    def test_upload_title_length_validation(self, test_client, auth_headers):
        client, _ = test_client
        overlong_title = "A" * 301
        # Multipart form overlong title
        res_over = client.post(
            "/api/admin/documents",
            data={"title": overlong_title, "category": "academic"},
            headers=auth_headers,
        )
        assert res_over.status_code == 422
        assert res_over.json()["error"]["code"] == "invalid_request"

        # Multipart form empty title
        res_empty = client.post(
            "/api/admin/documents",
            data={"title": "   ", "category": "academic"},
            headers=auth_headers,
        )
        assert res_empty.status_code == 422
        assert res_empty.json()["error"]["code"] == "invalid_request"

        # JSON empty title
        res_json_empty = client.post(
            "/api/admin/documents",
            json={"title": "   ", "category": "academic"},
            headers=auth_headers,
        )
        assert res_json_empty.status_code == 422
        assert res_json_empty.json()["error"]["code"] == "invalid_request"

    def test_get_nonexistent_job_returns_404_error_envelope(self, test_client, auth_headers):
        client, _ = test_client
        res = client.get("/api/admin/jobs/non_existent_job_uuid_999", headers=auth_headers)
        assert res.status_code == 404
        err = res.json()["error"]
        assert err["code"] == "job_not_found"
        assert res.headers.get("X-Request-ID") == err["request_id"]

    def test_upload_json_rejects_unauthorized_extra_fields(self, test_client, auth_headers):
        client, _ = test_client
        payload = {
            "title": "Tài liệu hợp lệ",
            "category": "academic",
            "unauthorized_field": "injected_value",
            "admin_privilege_escalation": True,
        }
        res = client.post("/api/admin/documents", json=payload, headers=auth_headers)
        assert res.status_code == 422
        assert res.json()["error"]["code"] == "invalid_request"
