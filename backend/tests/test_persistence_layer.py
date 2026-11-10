"""Tests for VKU Assist Persistence Layer Architecture.

Validates:
- BaseStorage contract and interface implementation
- SQLiteStorage operations
- DynamoDBStorage Single-Table Design operations (CRUD, pagination, cascade delete, GSI queries)
- S3DocumentStorage document persistence operations
- Factory instantiation and backend switching (sqlite vs dynamodb)
- Full API integration with DynamoDB storage backend
"""
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.storage.base import BaseStorage
from app.storage.database import Database, SQLiteStorage
from app.storage.dynamodb import DynamoDBStorage
from app.storage.factory import create_storage
from app.storage.s3 import S3DocumentStorage


class TestStorageAbstraction:
    """Verify BaseStorage contracts and factory functionality."""

    def test_sqlite_implements_base_storage(self):
        assert issubclass(SQLiteStorage, BaseStorage)
        assert issubclass(Database, BaseStorage)

    def test_dynamodb_implements_base_storage(self):
        assert issubclass(DynamoDBStorage, BaseStorage)

    def test_factory_creates_sqlite_by_default(self):
        settings = Settings(_env_file=None, app_env="test", storage_backend="sqlite")
        storage = create_storage(settings)
        assert isinstance(storage, SQLiteStorage)
        storage.close()

    def test_factory_creates_dynamodb_backend(self):
        settings = Settings(
            _env_file=None,
            app_env="test",
            storage_backend="dynamodb",
            dynamodb_table_name=":memory:",
        )
        storage = create_storage(settings)
        assert isinstance(storage, DynamoDBStorage)
        assert storage.use_mock is True
        storage.close()


class TestDynamoDBStorageOperations:
    """Verify DynamoDBStorage Single-Table Design mechanics."""

    @pytest.fixture
    def storage(self):
        st = DynamoDBStorage(table_name=":memory:", use_mock=True)
        yield st
        st.close()

    def test_session_lifecycle(self, storage: DynamoDBStorage):
        # Create
        created = storage.create_session(
            session_id="dyn_sess_1",
            title="Tư vấn xét tuyển",
            session_token="token_user_x",
        )
        assert created["id"] == "dyn_sess_1"
        assert created["title"] == "Tư vấn xét tuyển"
        assert created["session_token"] == "token_user_x"

        # Get without messages
        fetched = storage.get_session("dyn_sess_1", include_messages=False)
        assert fetched is not None
        assert fetched["title"] == "Tư vấn xét tuyển"
        assert fetched["messages"] == []

        # Update title
        updated = storage.update_session("dyn_sess_1", title="Tư vấn xét tuyển 2026")
        assert updated is not None
        assert updated["title"] == "Tư vấn xét tuyển 2026"

        # Delete
        assert storage.delete_session("dyn_sess_1") is True
        assert storage.get_session("dyn_sess_1") is None

    def test_messages_chronological_order_and_cascade(self, storage: DynamoDBStorage):
        storage.create_session("sess_cascade", title="Cascade Test")

        # Add user and bot messages
        msg1 = storage.add_message(
            message_id="msg_001",
            session_id="sess_cascade",
            role="user",
            content="Quy chế tín chỉ?",
            created_at="2026-11-06T10:00:00Z",
        )
        msg2 = storage.add_message(
            message_id="msg_002",
            session_id="sess_cascade",
            role="assistant",
            content="Theo quy chế tín chỉ...",
            sources=[{"source_id": "S1", "title": "Quy chế"}],
            created_at="2026-11-06T10:01:00Z",
        )

        # Retrieve messages
        msgs = storage.get_messages("sess_cascade")
        assert len(msgs) == 2
        assert msgs[0]["message_id"] == "msg_001"
        assert msgs[1]["message_id"] == "msg_002"
        assert msgs[1]["sources"][0]["source_id"] == "S1"

        # Auto session detail includes messages
        detail = storage.get_session("sess_cascade", include_messages=True)
        assert len(detail["messages"]) == 2

        # Delete message
        assert storage.delete_message("msg_001") is True
        assert len(storage.get_messages("sess_cascade")) == 1

        # Delete session cascades remaining messages
        assert storage.delete_session("sess_cascade") is True
        assert len(storage.get_messages("sess_cascade")) == 0

    def test_list_sessions_and_token_filter(self, storage: DynamoDBStorage):
        storage.create_session("s_u1_a", title="User 1 A", session_token="tok_1")
        storage.create_session("s_u1_b", title="User 1 B", session_token="tok_1")
        storage.create_session("s_u2_a", title="User 2 A", session_token="tok_2")

        # Filter by tok_1
        items, total = storage.list_sessions(session_token="tok_1")
        assert total == 2
        assert len(items) == 2
        assert all(it["session_token"] == "tok_1" for it in items)

        # Clear by token
        cleared = storage.clear_sessions(session_token="tok_1")
        assert cleared == 2
        _, rem = storage.list_sessions()
        assert rem == 1

    def test_feedback_operations(self, storage: DynamoDBStorage):
        fb = storage.create_feedback(
            feedback_id="fb_001",
            message_id="msg_123",
            rating="helpful",
            comment="Rất chi tiết và chính xác.",
            session_id="sess_001",
        )
        assert fb["feedback_id"] == "fb_001"
        assert fb["status"] == "recorded"

        # Get
        fetched = storage.get_feedback("fb_001")
        assert fetched is not None
        assert fetched["rating"] == "helpful"

        # List
        items, total = storage.list_feedbacks()
        assert total == 1
        assert items[0]["feedback_id"] == "fb_001"

        # Delete
        assert storage.delete_feedback("fb_001") is True
        assert storage.get_feedback("fb_001") is None


class TestS3DocumentStorageOperations:
    """Verify S3 Document Storage abstraction and fallback."""

    def test_local_filesystem_crud(self, tmp_path):
        s3 = S3DocumentStorage(bucket_name=None, local_dir=tmp_path)

        # Upload
        uri = s3.upload_file(b"test document content", key="regulations/academic.txt")
        assert "academic.txt" in uri

        # Download
        content = s3.download_file("regulations/academic.txt")
        assert content == b"test document content"

        # List
        files = s3.list_files()
        assert "regulations/academic.txt" in files

        # Delete
        assert s3.delete_file("regulations/academic.txt") is True
        assert s3.download_file("regulations/academic.txt") is None

    def test_s3_storage_binary_pdf_and_nested_keys(self, tmp_path):
        s3 = S3DocumentStorage(bucket_name=None, local_dir=tmp_path)
        pdf_bytes = b"%PDF-1.7\n\x00\xff\xfe sample binary content with utf8 \xe1\xbb\x99"
        nested_key = "indexes/2026_q1/nested/sample_regulation.pdf"

        # Upload
        uri = s3.upload_file(pdf_bytes, key=nested_key)
        assert "sample_regulation.pdf" in uri

        # Download & verify binary fidelity byte-for-byte
        downloaded = s3.download_file(nested_key)
        assert downloaded == pdf_bytes

        # Non-existent file returns None
        assert s3.download_file("non/existent/file.bin") is None

        # Deleting non-existent file returns False without error
        assert s3.delete_file("non/existent/file.bin") is False

        # Close is clean and idempotent
        s3.close()


class TestAPIFullStackWithDynamoDB:
    """Verify FastAPI endpoints running with DynamoDB backend."""

    def test_api_session_and_feedback_with_dynamodb_backend(self):
        settings = Settings(
            _env_file=None,
            app_env="test",
            storage_backend="dynamodb",
            dynamodb_table_name=":memory:",
        )
        app = create_app(settings)
        client = TestClient(app)

        # 1. Create Session
        res = client.post("/api/sessions", json={"title": "Tuyển sinh VKU 2026"})
        assert res.status_code == 201
        sess_data = res.json()
        sess_id = sess_data["id"]

        # 2. Add message
        msg_res = client.post(
            f"/api/sessions/{sess_id}/messages",
            json={"role": "user", "content": "Ngành An toàn thông tin xét tuyển thế nào?"},
        )
        assert msg_res.status_code == 201
        msg_id = msg_res.json()["message_id"]

        # 3. Add bot message
        client.post(
            f"/api/sessions/{sess_id}/messages",
            json={"role": "assistant", "content": "Xét theo điểm thi tốt nghiệp THPT..."},
        )

        # 4. Get session detail
        get_res = client.get(f"/api/sessions/{sess_id}")
        assert get_res.status_code == 200
        detail = get_res.json()
        assert len(detail["messages"]) == 2

        # 5. Submit Feedback
        fb_res = client.post(
            "/api/feedback",
            json={
                "message_id": msg_id,
                "rating": "helpful",
                "comment": "Thông tin rất rõ ràng",
                "session_id": sess_id,
            },
        )
        assert fb_res.status_code == 201

        # 6. List feedback
        fbs = client.get("/api/feedback").json()
        assert fbs["total"] >= 1

        # 7. Clean up
        app.state.db.close()
