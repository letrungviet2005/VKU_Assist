"""Automated tests for VKU Assist Feedback Collection API (/api/feedback).

Tests:
- POST /api/feedback (Helpful / Not Helpful submission, comment, session linkage)
- GET /api/feedback (Listing feedback, pagination limit/offset, total count)
- DELETE /api/feedback/{feedback_id} (Deletion and 404 handling)
- Validation constraints: rating choices, missing fields
- Error Envelopes: 404 feedback_not_found, 422 invalid_request, 500 database_unavailable
"""
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient


@pytest.mark.api
class TestFeedbackSubmission:
    """Test feedback submission endpoint."""

    def test_submit_helpful_feedback_with_all_fields(self, client: TestClient):
        """Verify successful feedback submission with message_id, session_id, rating and comment."""
        payload = {
            "message_id": "msg_98a76b54c321",
            "session_id": "session_test_456",
            "rating": "helpful",
            "comment": "Câu trả lời trích dẫn chính xác đề án tuyển sinh VKU 2026.",
        }
        res = client.post("/api/feedback", json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["feedback_id"].startswith("fb_")
        assert data["message_id"] == "msg_98a76b54c321"
        assert data["session_id"] == "session_test_456"
        assert data["rating"] == "helpful"
        assert data["comment"] == "Câu trả lời trích dẫn chính xác đề án tuyển sinh VKU 2026."
        assert data["status"] == "recorded"
        assert "created_at" in data

    def test_submit_not_helpful_feedback_minimal(self, client: TestClient):
        """Verify submitting not_helpful feedback without comment or session_id."""
        payload = {
            "message_id": "msg_002",
            "rating": "not_helpful",
        }
        res = client.post("/api/feedback", json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["rating"] == "not_helpful"
        assert data["comment"] is None
        assert data["session_id"] is None
        assert data["status"] == "recorded"

    @pytest.mark.parametrize("invalid_rating", ["good", "bad", "neutral", "1", ""])
    def test_submit_feedback_rejects_invalid_ratings(self, client: TestClient, invalid_rating: str):
        """Verify rating must be strictly 'helpful' or 'not_helpful'."""
        res = client.post(
            "/api/feedback",
            json={"message_id": "msg_123", "rating": invalid_rating},
        )
        assert res.status_code == 422
        assert "error" in res.json()

    def test_submit_feedback_missing_message_id(self, client: TestClient):
        """Verify missing message_id returns 422."""
        res = client.post(
            "/api/feedback",
            json={"rating": "helpful"},
        )
        assert res.status_code == 422


@pytest.mark.api
class TestFeedbackListingAndPagination:
    """Test retrieving feedback list and pagination."""

    def test_list_feedback_pagination(self, client: TestClient):
        """Verify limit and offset query params."""
        for i in range(5):
            client.post(
                "/api/feedback",
                json={"message_id": f"msg_batch_{i}", "rating": "helpful" if i % 2 == 0 else "not_helpful"},
            )

        res = client.get("/api/feedback?limit=3&offset=0")
        assert res.status_code == 200
        data = res.json()
        assert len(data["items"]) == 3
        assert data["total"] >= 5

        res_p2 = client.get("/api/feedback?limit=3&offset=3")
        assert res_p2.status_code == 200
        data_p2 = res_p2.json()
        assert len(data_p2["items"]) >= 2

        # Verify items are distinct
        ids_p1 = {item["feedback_id"] for item in data["items"]}
        ids_p2 = {item["feedback_id"] for item in data_p2["items"]}
        assert ids_p1.isdisjoint(ids_p2)

    @pytest.mark.parametrize("invalid_bounds", [
        "limit=0",
        "limit=201",
        "offset=-1",
    ])
    def test_list_feedback_invalid_pagination(self, client: TestClient, invalid_bounds: str):
        """Verify bounds: limit between 1 and 200, offset >= 0."""
        res = client.get(f"/api/feedback?{invalid_bounds}")
        assert res.status_code == 422


@pytest.mark.api
class TestFeedbackDeletion:
    """Test deleting feedback and 404 handling."""

    def test_delete_feedback_success(self, client: TestClient):
        """Verify feedback deletion."""
        created = client.post(
            "/api/feedback",
            json={"message_id": "msg_to_del", "rating": "helpful"},
        ).json()
        fb_id = created["feedback_id"]

        del_res = client.delete(f"/api/feedback/{fb_id}")
        assert del_res.status_code == 200
        assert del_res.json() == {"status": "deleted", "id": fb_id}

        # Second deletion should return 404
        del_again = client.delete(f"/api/feedback/{fb_id}")
        assert del_again.status_code == 404
        error = del_again.json()["error"]
        assert error["code"] == "feedback_not_found"
        assert fb_id in error["message"]

    def test_database_unavailable_feedback(self, client: TestClient):
        """Verify 500 when database is not available."""
        with patch("app.api.feedback.get_db") as mock_db:
            from app.core.errors import ServiceError
            mock_db.side_effect = ServiceError(500, "database_unavailable", "Cơ sở dữ liệu chưa sẵn sàng.")
            res = client.get("/api/feedback")
            assert res.status_code == 500
            assert res.json()["error"]["code"] == "database_unavailable"
