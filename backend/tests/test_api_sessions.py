"""Automated tests for VKU Assist Session Management API (/api/sessions).

Tests all endpoints, parameters, validations, cascade behaviors, and error envelopes:
- POST /api/sessions (Create session with defaults, custom id, title, token)
- GET /api/sessions (List sessions, pagination limit/offset, token filter, message_count)
- GET /api/sessions/{session_id} (Session detail with complete messages list)
- PATCH /api/sessions/{session_id} (Update session title)
- DELETE /api/sessions/{session_id} (Delete session and cascade delete messages)
- DELETE /api/sessions (Clear all sessions or sessions matching session_token)
- GET /api/sessions/{session_id}/messages (List messages in session ordered by created_at)
- POST /api/sessions/{session_id}/messages (Add message with role, sources, auto-session creation)
- Error Envelopes: 404 session_not_found, 422 validation_error, 500 database_unavailable
"""
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient


@pytest.mark.api
class TestSessionCreation:
    """Test session creation endpoints with various payload options."""

    def test_create_session_defaults(self, client: TestClient):
        """Verify default title and auto-generated UUID session id."""
        res = client.post("/api/sessions", json={})
        assert res.status_code == 201
        data = res.json()
        assert data["id"].startswith("session_")
        assert data["title"] == "Cuộc trò chuyện mới"
        assert data["messages"] == []
        assert "created_at" in data
        assert "updated_at" in data

    def test_create_session_custom_id_and_title(self, client: TestClient):
        """Verify session creation with custom session id, title, and session token."""
        payload = {
            "id": "custom_sess_001",
            "title": "Tư vấn tuyển sinh ngành Trí tuệ Nhân tạo 2026",
            "session_token": "token_student_anon_42",
        }
        res = client.post("/api/sessions", json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["id"] == "custom_sess_001"
        assert data["title"] == "Tư vấn tuyển sinh ngành Trí tuệ Nhân tạo 2026"
        assert data["session_token"] == "token_student_anon_42"
        assert data["messages"] == []


@pytest.mark.api
class TestSessionListingAndPagination:
    """Test listing sessions with pagination and token filtering."""

    def test_list_sessions_pagination(self, client: TestClient):
        """Verify limit and offset query parameters and total counter."""
        for i in range(5):
            client.post("/api/sessions", json={"title": f"Phiên thảo luận #{i}"})

        # Fetch first page of 2
        res1 = client.get("/api/sessions?limit=2&offset=0")
        assert res1.status_code == 200
        data1 = res1.json()
        assert len(data1["sessions"]) == 2
        assert data1["total"] >= 5

        # Fetch second page of 2
        res2 = client.get("/api/sessions?limit=2&offset=2")
        assert res2.status_code == 200
        data2 = res2.json()
        assert len(data2["sessions"]) == 2

        # Verify no overlap between page 1 and page 2
        ids1 = {s["id"] for s in data1["sessions"]}
        ids2 = {s["id"] for s in data2["sessions"]}
        assert ids1.isdisjoint(ids2)

    def test_list_sessions_filter_by_token(self, client: TestClient):
        """Verify sessions are isolated per user session token."""
        client.post("/api/sessions", json={"title": "User A Session 1", "session_token": "token_user_a"})
        client.post("/api/sessions", json={"title": "User A Session 2", "session_token": "token_user_a"})
        client.post("/api/sessions", json={"title": "User B Session 1", "session_token": "token_user_b"})

        res_a = client.get("/api/sessions?session_token=token_user_a")
        assert res_a.status_code == 200
        data_a = res_a.json()
        assert data_a["total"] == 2
        assert all(s["session_token"] == "token_user_a" for s in data_a["sessions"])

        res_b = client.get("/api/sessions?session_token=token_user_b")
        assert res_b.status_code == 200
        data_b = res_b.json()
        assert data_b["total"] == 1
        assert data_b["sessions"][0]["title"] == "User B Session 1"

    @pytest.mark.parametrize("invalid_param", [
        "limit=0",
        "limit=101",
        "offset=-1",
        "limit=abc",
    ])
    def test_list_sessions_invalid_pagination_bounds(self, client: TestClient, invalid_param: str):
        """Verify invalid pagination queries return 422 Unprocessable Entity."""
        res = client.get(f"/api/sessions?{invalid_param}")
        assert res.status_code == 422
        assert "error" in res.json()


@pytest.mark.api
class TestSessionDetailAndUpdate:
    """Test retrieving session details and updating title."""

    def test_get_session_detail_success(self, client: TestClient, sample_session: dict):
        """Verify session detail includes all messages and metadata."""
        session_id = sample_session["id"]
        res = client.get(f"/api/sessions/{session_id}")
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == session_id
        assert len(data["messages"]) == 2
        assert data["messages"][0]["role"] == "user"
        assert data["messages"][1]["role"] == "assistant"
        assert len(data["messages"][1]["sources"]) == 1

    def test_get_session_not_found(self, client: TestClient):
        """Verify 404 error envelope when session ID does not exist."""
        res = client.get("/api/sessions/non_existent_session_id")
        assert res.status_code == 404
        error = res.json()["error"]
        assert error["code"] == "session_not_found"
        assert "non_existent_session_id" in error["message"]
        assert "request_id" in error

    def test_update_session_title(self, client: TestClient):
        """Verify PATCH /api/sessions/{session_id} updates title."""
        created = client.post("/api/sessions", json={"title": "Tên cũ"}).json()
        session_id = created["id"]

        patch_res = client.patch(f"/api/sessions/{session_id}", json={"title": "Tên mới đã cập nhật"})
        assert patch_res.status_code == 200
        updated = patch_res.json()
        assert updated["title"] == "Tên mới đã cập nhật"

        # Verify persisted via GET
        get_res = client.get(f"/api/sessions/{session_id}")
        assert get_res.json()["title"] == "Tên mới đã cập nhật"

    def test_update_session_not_found(self, client: TestClient):
        """Verify 404 when updating non-existent session."""
        res = client.patch("/api/sessions/unknown_sess", json={"title": "Any title"})
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "session_not_found"


@pytest.mark.api
class TestSessionDeletionAndCascade:
    """Test deletion of single sessions, clear all, and cascade message deletion."""

    def test_delete_session_cascades_messages(self, client: TestClient, sample_session: dict):
        """Verify deleting a session completely cascades and deletes all related messages."""
        session_id = sample_session["id"]

        # Confirm messages exist
        msgs_before = client.get(f"/api/sessions/{session_id}/messages")
        assert msgs_before.status_code == 200
        assert len(msgs_before.json()) == 2

        # Delete session
        del_res = client.delete(f"/api/sessions/{session_id}")
        assert del_res.status_code == 200
        assert del_res.json() == {"status": "deleted", "id": session_id}

        # Subsequent GET should be 404
        get_res = client.get(f"/api/sessions/{session_id}")
        assert get_res.status_code == 404

        # Messages endpoint should also be 404
        msgs_after = client.get(f"/api/sessions/{session_id}/messages")
        assert msgs_after.status_code == 404

    def test_delete_session_not_found(self, client: TestClient):
        """Verify 404 when deleting a non-existent session."""
        res = client.delete("/api/sessions/sess_does_not_exist")
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "session_not_found"

    def test_clear_sessions_global_and_by_token(self, client: TestClient):
        """Verify bulk deletion optionally isolated by session_token."""
        # Create sessions with tokens
        client.post("/api/sessions", json={"title": "Token 1", "session_token": "token_clear_target"})
        client.post("/api/sessions", json={"title": "Token 2", "session_token": "token_clear_target"})
        client.post("/api/sessions", json={"title": "Keep me", "session_token": "token_keep"})

        # Clear only target token
        clear_tok_res = client.delete("/api/sessions?session_token=token_clear_target")
        assert clear_tok_res.status_code == 200
        assert clear_tok_res.json()["deleted_count"] == 2

        # Verify kept session remains
        remaining = client.get("/api/sessions").json()
        assert remaining["total"] >= 1
        assert any(s["session_token"] == "token_keep" for s in remaining["sessions"])

        # Global clear
        clear_all_res = client.delete("/api/sessions")
        assert clear_all_res.status_code == 200
        assert client.get("/api/sessions").json()["total"] == 0


@pytest.mark.api
class TestSessionMessages:
    """Test message appending, formatting, and validation."""

    def test_add_message_auto_creates_session_if_missing(self, client: TestClient):
        """Verify adding a message to an uncreated session id automatically creates the session."""
        new_sess_id = "auto_created_sess_88"
        msg_res = client.post(
            f"/api/sessions/{new_sess_id}/messages",
            json={
                "role": "user",
                "content": "Học bổng VKU dành cho thủ khoa là bao nhiêu?",
            },
        )
        assert msg_res.status_code == 201
        msg_data = msg_res.json()
        assert msg_data["session_id"] == new_sess_id
        assert msg_data["content"] == "Học bổng VKU dành cho thủ khoa là bao nhiêu?"

        # Verify session now exists
        sess_res = client.get(f"/api/sessions/{new_sess_id}")
        assert sess_res.status_code == 200
        assert len(sess_res.json()["messages"]) == 1

    @pytest.mark.parametrize("invalid_role", ["admin", "bot", "hacker", ""])
    def test_add_message_rejects_invalid_roles(self, client: TestClient, invalid_role: str):
        """Verify only 'user', 'assistant', 'system' are accepted roles."""
        sess = client.post("/api/sessions", json={"title": "Test"}).json()
        res = client.post(
            f"/api/sessions/{sess['id']}/messages",
            json={"role": invalid_role, "content": "Nội dung"},
        )
        assert res.status_code == 422
        assert "error" in res.json()

    def test_add_message_empty_content_rejected(self, client: TestClient):
        """Verify empty or missing content is rejected."""
        sess = client.post("/api/sessions", json={"title": "Test"}).json()
        res = client.post(
            f"/api/sessions/{sess['id']}/messages",
            json={"role": "user", "content": ""},
        )
        assert res.status_code == 422

    def test_database_unavailable_returns_500(self, client: TestClient):
        """Verify 500 database_unavailable when database service is unready."""
        with patch("app.api.sessions.get_db") as mock_db:
            from app.core.errors import ServiceError
            mock_db.side_effect = ServiceError(500, "database_unavailable", "Cơ sở dữ liệu chưa sẵn sàng.")
            res = client.get("/api/sessions")
            assert res.status_code == 500
            assert res.json()["error"]["code"] == "database_unavailable"
