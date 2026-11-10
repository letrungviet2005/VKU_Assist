import unittest
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


@pytest.mark.api
class SessionTests(unittest.TestCase):
    def setUp(self):
        self.settings = Settings(_env_file=None, app_env="test", db_path=":memory:")
        self.app = create_app(self.settings)
        self.client = TestClient(self.app)

    def tearDown(self):
        if hasattr(self.app.state, "db") and self.app.state.db:
            self.app.state.db.close()

    def test_create_and_get_session(self):
        # Create session
        res = self.client.post("/api/sessions", json={"title": "Tra cứu học bổng"})
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertIn("id", data)
        self.assertEqual(data["title"], "Tra cứu học bổng")
        self.assertEqual(data["messages"], [])
        session_id = data["id"]

        # Get session
        get_res = self.client.get(f"/api/sessions/{session_id}")
        self.assertEqual(get_res.status_code, 200)
        get_data = get_res.json()
        self.assertEqual(get_data["id"], session_id)
        self.assertEqual(get_data["title"], "Tra cứu học bổng")

    def test_list_and_update_session(self):
        # Create two sessions
        s1 = self.client.post("/api/sessions", json={"title": "Session 1"}).json()
        s2 = self.client.post("/api/sessions", json={"title": "Session 2"}).json()

        # List
        list_res = self.client.get("/api/sessions")
        self.assertEqual(list_res.status_code, 200)
        list_data = list_res.json()
        self.assertGreaterEqual(list_data["total"], 2)
        session_ids = [s["id"] for s in list_data["sessions"]]
        self.assertIn(s1["id"], session_ids)
        self.assertIn(s2["id"], session_ids)

        # Update title
        patch_res = self.client.patch(f"/api/sessions/{s1['id']}", json={"title": "Session 1 Renamed"})
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.json()["title"], "Session 1 Renamed")

    def test_session_messages_crud(self):
        # Create session
        sess = self.client.post("/api/sessions", json={"title": "Chat Hóa đơn"}).json()
        sess_id = sess["id"]

        # Add user message
        user_msg = self.client.post(
            f"/api/sessions/{sess_id}/messages",
            json={
                "role": "user",
                "content": "Học phí một tín chỉ bao nhiêu?",
            },
        )
        self.assertEqual(user_msg.status_code, 201)
        user_msg_data = user_msg.json()
        self.assertEqual(user_msg_data["role"], "user")
        self.assertEqual(user_msg_data["content"], "Học phí một tín chỉ bao nhiêu?")

        # Add assistant message with sources
        sources = [
            {
                "source_id": "S1",
                "chunk_id": "chk_1",
                "document_id": "doc_hocphi",
                "title": "Quy định học phí 2026",
                "url": "https://vku.udn.vn/hoc-phi",
            }
        ]
        bot_msg = self.client.post(
            f"/api/sessions/{sess_id}/messages",
            json={
                "role": "assistant",
                "content": "Học phí là 450.000 VNĐ/tín chỉ [S1].",
                "status": "answered",
                "sources": sources,
            },
        )
        self.assertEqual(bot_msg.status_code, 201)

        # Get messages
        msgs_res = self.client.get(f"/api/sessions/{sess_id}/messages")
        self.assertEqual(msgs_res.status_code, 200)
        msgs = msgs_res.json()
        self.assertEqual(len(msgs), 2)
        self.assertEqual(msgs[0]["role"], "user")
        self.assertEqual(msgs[1]["role"], "assistant")
        self.assertEqual(len(msgs[1]["sources"]), 1)
        self.assertEqual(msgs[1]["sources"][0]["document_id"], "doc_hocphi")

        # Verify session detail includes messages
        detail = self.client.get(f"/api/sessions/{sess_id}").json()
        self.assertEqual(len(detail["messages"]), 2)

    def test_delete_and_clear_sessions(self):
        s1 = self.client.post("/api/sessions", json={"title": "To Delete"}).json()
        del_res = self.client.delete(f"/api/sessions/{s1['id']}")
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.json()["status"], "deleted")

        # Verify deleted
        get_res = self.client.get(f"/api/sessions/{s1['id']}")
        self.assertEqual(get_res.status_code, 404)

        # Create more and clear
        self.client.post("/api/sessions", json={"title": "A"})
        self.client.post("/api/sessions", json={"title": "B"})
        clear_res = self.client.delete("/api/sessions")
        self.assertEqual(clear_res.status_code, 200)
        self.assertGreaterEqual(clear_res.json()["deleted_count"], 2)

        # Verify list is empty
        list_res = self.client.get("/api/sessions")
        self.assertEqual(list_res.json()["total"], 0)

    def test_not_found_and_validation(self):
        # 404 on missing session
        res = self.client.get("/api/sessions/non_existent")
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()["error"]["code"], "session_not_found")

        # 422 on invalid message role
        sess = self.client.post("/api/sessions", json={"title": "Valid"}).json()
        bad_msg = self.client.post(
            f"/api/sessions/{sess['id']}/messages",
            json={"role": "unknown_role", "content": "hello"},
        )
        self.assertEqual(bad_msg.status_code, 422)
