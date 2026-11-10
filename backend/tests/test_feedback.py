import unittest
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


@pytest.mark.api
class FeedbackTests(unittest.TestCase):
    def setUp(self):
        self.settings = Settings(_env_file=None, app_env="test", db_path=":memory:")
        self.app = create_app(self.settings)
        self.client = TestClient(self.app)

    def tearDown(self):
        if hasattr(self.app.state, "db") and self.app.state.db:
            self.app.state.db.close()

    def test_submit_and_list_feedback(self):
        # Submit helpful feedback
        res1 = self.client.post(
            "/api/feedback",
            json={
                "message_id": "msg_001",
                "rating": "helpful",
                "comment": "Thông tin rất rõ ràng và chuẩn xác.",
            },
        )
        self.assertEqual(res1.status_code, 201)
        data1 = res1.json()
        self.assertIn("feedback_id", data1)
        self.assertEqual(data1["rating"], "helpful")
        self.assertEqual(data1["comment"], "Thông tin rất rõ ràng và chuẩn xác.")
        self.assertEqual(data1["status"], "recorded")

        # Submit not_helpful feedback
        res2 = self.client.post(
            "/api/feedback",
            json={
                "message_id": "msg_002",
                "rating": "not_helpful",
                "comment": "Cần bổ sung điều kiện 2026.",
            },
        )
        self.assertEqual(res2.status_code, 201)

        # List feedback
        list_res = self.client.get("/api/feedback")
        self.assertEqual(list_res.status_code, 200)
        list_data = list_res.json()
        self.assertGreaterEqual(list_data["total"], 2)
        ratings = [item["rating"] for item in list_data["items"]]
        self.assertIn("helpful", ratings)
        self.assertIn("not_helpful", ratings)

    def test_delete_feedback(self):
        res = self.client.post(
            "/api/feedback",
            json={
                "message_id": "msg_003",
                "rating": "helpful",
            },
        )
        fb_id = res.json()["feedback_id"]

        # Delete
        del_res = self.client.delete(f"/api/feedback/{fb_id}")
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.json()["status"], "deleted")

        # Delete again -> 404
        del_res2 = self.client.delete(f"/api/feedback/{fb_id}")
        self.assertEqual(del_res2.status_code, 404)
        self.assertEqual(del_res2.json()["error"]["code"], "feedback_not_found")

    def test_invalid_rating_rejected(self):
        bad_res = self.client.post(
            "/api/feedback",
            json={
                "message_id": "msg_004",
                "rating": "excellent",  # Only 'helpful' | 'not_helpful' allowed
            },
        )
        self.assertEqual(bad_res.status_code, 422)
