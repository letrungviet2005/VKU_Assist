from contextlib import contextmanager
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Generator

from app.storage.base import BaseStorage


def utc_now_iso() -> str:
    """Return current UTC timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


class Database(BaseStorage):
    """SQLite Database Manager for VKU Assist sessions, messages, and feedback."""

    def __init__(self, db_path: str | Path = "data/vku_assist.db"):
        self.db_path = str(db_path)
        self._mem_conn: sqlite3.Connection | None = None
        if self.db_path == ":memory:":
            self._mem_conn = sqlite3.connect(":memory:", check_same_thread=False)
            self._mem_conn.row_factory = sqlite3.Row
            self._mem_conn.execute("PRAGMA foreign_keys = ON")
        self._init_db()

    def get_connection(self) -> sqlite3.Connection:
        """Create a new SQLite connection with foreign keys and dict row factory."""
        if self._mem_conn is not None:
            return self._mem_conn

        parent = Path(self.db_path).parent
        if parent and not parent.exists():
            parent.mkdir(parents=True, exist_ok=True)

        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        return conn

    @contextmanager
    def connection(self) -> Generator[sqlite3.Connection, None, None]:
        """Context manager for obtaining a database connection that properly closes."""
        if self._mem_conn is not None:
            yield self._mem_conn
        else:
            conn = self.get_connection()
            try:
                yield conn
            finally:
                conn.close()

    def close(self):
        """Close database connection."""
        if self._mem_conn is not None:
            self._mem_conn.close()
            self._mem_conn = None

    def _init_db(self):
        """Initialize database schema tables and indexes."""
        with self.connection() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS chat_sessions (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    session_token TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS chat_messages (
                    message_id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    status TEXT,
                    sources TEXT,
                    request_id TEXT,
                    index_version TEXT,
                    generation_mode TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id);

                CREATE TABLE IF NOT EXISTS feedbacks (
                    feedback_id TEXT PRIMARY KEY,
                    message_id TEXT NOT NULL,
                    session_id TEXT,
                    rating TEXT NOT NULL,
                    comment TEXT,
                    created_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_feedbacks_message ON feedbacks(message_id);

                CREATE TABLE IF NOT EXISTS documents (
                    document_id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    category TEXT NOT NULL,
                    source_url TEXT,
                    applicable_year INTEGER,
                    issue_date TEXT,
                    version TEXT NOT NULL DEFAULT 'v1.0',
                    status TEXT NOT NULL DEFAULT 'ready',
                    chunks_count INTEGER NOT NULL DEFAULT 0,
                    size_mb REAL NOT NULL DEFAULT 0.0,
                    file_path TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
                CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

                CREATE TABLE IF NOT EXISTS indexing_jobs (
                    job_id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'processing',
                    progress INTEGER NOT NULL DEFAULT 0,
                    index_version TEXT,
                    error_message TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_jobs_status ON indexing_jobs(status);
            """)

            # Seed default VKU official knowledge documents if table is empty
            cur = conn.execute("SELECT COUNT(*) FROM documents")
            now = utc_now_iso()
            if cur.fetchone()[0] == 0:
                default_docs = [
                    (
                        "doc-vku-admissions-2026",
                        "Cổng thông tin Tuyển sinh Đại học chính quy VKU",
                        "admissions",
                        "https://tuyensinh.vku.udn.vn/",
                        2026,
                        "2026-01-15",
                        "v2.1",
                        "ready",
                        142,
                        3.4,
                    ),
                    (
                        "doc-vku-academic-regs-2025",
                        "Cổng thông tin Đào tạo & Quy chế học vụ VKU",
                        "academic",
                        "https://daotao.vku.udn.vn/",
                        2025,
                        "2025-08-20",
                        "v1.4",
                        "ready",
                        215,
                        5.1,
                    ),
                    (
                        "doc-vku-scholarships-2026",
                        "Thông tin Học bổng & Hỗ trợ sinh viên VKU",
                        "admissions",
                        "https://tuyensinh.vku.udn.vn/",
                        2026,
                        "2026-02-01",
                        "v1.0",
                        "ready",
                        68,
                        1.8,
                    ),
                    (
                        "doc-vku-graduation-benchmark",
                        "Thông báo Quy định chuẩn đầu ra & Xét tốt nghiệp VKU",
                        "academic",
                        "https://daotao.vku.udn.vn/",
                        2024,
                        "2024-11-10",
                        "v2.0",
                        "ready",
                        94,
                        2.2,
                    ),
                    (
                        "doc-vku-tuition-fee-2026",
                        "Thông tin Học phí & Chính sách đào tạo VKU",
                        "academic",
                        "https://vku.udn.vn/",
                        2026,
                        "2026-01-20",
                        "v1.1",
                        "ready",
                        48,
                        1.2,
                    ),
                ]
                conn.executemany(
                    """
                    INSERT INTO documents (
                        document_id, title, category, source_url, applicable_year,
                        issue_date, version, status, chunks_count, size_mb,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        (
                            d[0], d[1], d[2], d[3], d[4],
                            d[5], d[6], d[7], d[8], d[9],
                            now, now,
                        )
                        for d in default_docs
                    ],
                )
            else:
                # Replace any legacy placeholder 404 URLs in existing local DB with live official VKU URLs
                url_fixes = [
                    ("https://tuyensinh.vku.udn.vn/", "https://vku.udn.vn/tuyen-sinh/de-an-tuyen-sinh-2026"),
                    ("https://daotao.vku.udn.vn/", "https://vku.udn.vn/dao-tao/quy-che-tin-chi"),
                    ("https://tuyensinh.vku.udn.vn/", "https://vku.udn.vn/hoc-bong-tai-tro-2026"),
                    ("https://daotao.vku.udn.vn/", "https://vku.udn.vn/chuan-dau-ra-tot-nghiep"),
                    ("https://vku.udn.vn/", "https://vku.udn.vn/hoc-phi-2026"),
                    ("https://vku.udn.vn/", "https://vku.udn.vn/thong-bao-hoc-phi-2026"),
                ]
                for real_url, old_url in url_fixes:
                    conn.execute("UPDATE documents SET source_url = ? WHERE source_url = ?", (real_url, old_url))

            # Ensure verified VKU real public pilot articles are registered without duplicating existing rows
            pilot_docs = [
                (
                    "admissions-402-2026",
                    "Phương thức xét tuyển theo kết quả điểm thi ĐGNL ĐHQG TP. HCM (Mã 402)",
                    "admissions",
                    "https://tuyensinh.vku.udn.vn/thong-bao/69af034de1fedb5e0308e872",
                    2026,
                    "2026-02-10",
                    "html-snapshot-000dd3fa9959",
                    "ready",
                    4,
                    0.1,
                ),
                (
                    "admissions-entry-2026",
                    "Công bố điểm trúng tuyển Đại học chính quy VKU năm 2026",
                    "admissions",
                    "https://tuyensinh.vku.udn.vn/thong-bao/6a79472c0619ded1f20e9b44",
                    2026,
                    "2026-08-09",
                    "html-snapshot-dd7889c08ec9",
                    "ready",
                    4,
                    0.1,
                ),
                (
                    "academic-graduation-3-2026",
                    "[Thông báo] Nhận hồ sơ xét tốt nghiệp đợt 3 năm 2026",
                    "academic",
                    "https://daotao.vku.udn.vn/thong-bao-dao-tao/thong-bao-nhan-ho-so-xet-tot-nghiep-dot-3-nam-2026-1358.html",
                    2026,
                    "2026-06-16",
                    "html-snapshot-b83d827cd463",
                    "ready",
                    10,
                    0.2,
                ),
                (
                    "academic-graduation-4-2026",
                    "[Thông báo] Nhận hồ sơ xét tốt nghiệp đợt 4 năm 2026",
                    "academic",
                    "https://daotao.vku.udn.vn/thong-bao-dao-tao/thong-bao-nhan-ho-so-xet-tot-nghiep-dot-4-nam-2026-1385.html",
                    2026,
                    "2026-09-13",
                    "html-snapshot-43dfaf915e95",
                    "ready",
                    11,
                    0.2,
                ),
            ]
            conn.executemany(
                """
                INSERT OR IGNORE INTO documents (
                    document_id, title, category, source_url, applicable_year,
                    issue_date, version, status, chunks_count, size_mb,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        d[0], d[1], d[2], d[3], d[4],
                        d[5], d[6], d[7], d[8], d[9],
                        now, now,
                    )
                    for d in pilot_docs
                ],
            )
            conn.commit()

    # --- Session Operations ---

    def create_session(self, session_id: str, title: str = "Cuộc trò chuyện mới",
                       session_token: str | None = None) -> dict[str, Any]:
        now = utc_now_iso()
        with self.connection() as conn:
            conn.execute(
                "INSERT INTO chat_sessions (id, title, session_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (session_id, title, session_token, now, now),
            )
            conn.commit()
        return {
            "id": session_id,
            "title": title,
            "session_token": session_token,
            "created_at": now,
            "updated_at": now,
            "createdAt": now,
            "updatedAt": now,
            "messages": [],
        }

    def get_session(self, session_id: str, include_messages: bool = True) -> dict[str, Any] | None:
        with self.connection() as conn:
            cur = conn.execute("SELECT * FROM chat_sessions WHERE id = ?", (session_id,))
            row = cur.fetchone()
            if not row:
                return None
            session_data = dict(row)
            session_data["createdAt"] = session_data["created_at"]
            session_data["updatedAt"] = session_data["updated_at"]

            if include_messages:
                session_data["messages"] = self._fetch_messages(session_id, conn)
            return session_data

    def list_sessions(self, session_token: str | None = None, limit: int = 50,
                      offset: int = 0) -> tuple[list[dict[str, Any]], int]:
        with self.connection() as conn:
            if session_token:
                count_cur = conn.execute("SELECT COUNT(*) FROM chat_sessions WHERE session_token = ?", (session_token,))
                total = count_cur.fetchone()[0]
                cur = conn.execute(
                    "SELECT s.*, (SELECT COUNT(*) FROM chat_messages m WHERE m.session_id = s.id) as message_count "
                    "FROM chat_sessions s WHERE session_token = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?",
                    (session_token, limit, offset),
                )
            else:
                count_cur = conn.execute("SELECT COUNT(*) FROM chat_sessions")
                total = count_cur.fetchone()[0]
                cur = conn.execute(
                    "SELECT s.*, (SELECT COUNT(*) FROM chat_messages m WHERE m.session_id = s.id) as message_count "
                    "FROM chat_sessions s ORDER BY updated_at DESC LIMIT ? OFFSET ?",
                    (limit, offset),
                )
            rows = cur.fetchall()
            results = []
            for r in rows:
                item = dict(r)
                item["createdAt"] = item["created_at"]
                item["updatedAt"] = item["updated_at"]
                results.append(item)
            return results, total

    def update_session(self, session_id: str, title: str | None = None) -> dict[str, Any] | None:
        now = utc_now_iso()
        with self.connection() as conn:
            if title is not None:
                cur = conn.execute(
                    "UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?",
                    (title, now, session_id),
                )
            else:
                cur = conn.execute(
                    "UPDATE chat_sessions SET updated_at = ? WHERE id = ?",
                    (now, session_id),
                )
            if cur.rowcount == 0:
                return None
            conn.commit()
        return self.get_session(session_id)

    def delete_session(self, session_id: str) -> bool:
        with self.connection() as conn:
            cur = conn.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
            conn.commit()
            return cur.rowcount > 0

    def clear_sessions(self, session_token: str | None = None) -> int:
        with self.connection() as conn:
            if session_token:
                cur = conn.execute("DELETE FROM chat_sessions WHERE session_token = ?", (session_token,))
            else:
                cur = conn.execute("DELETE FROM chat_sessions")
            conn.commit()
            return cur.rowcount

    # --- Message Operations ---

    def add_message(self, message_id: str, session_id: str, role: str, content: str,
                    status: str | None = None, sources: list[dict] | None = None,
                    request_id: str | None = None, index_version: str | None = None,
                    generation_mode: str | None = None, created_at: str | None = None) -> dict[str, Any]:
        now = created_at or utc_now_iso()
        sources_json = json.dumps(sources, ensure_ascii=False) if sources is not None else None

        with self.connection() as conn:
            # Check if session exists; if not, create it
            cur = conn.execute("SELECT id FROM chat_sessions WHERE id = ?", (session_id,))
            if not cur.fetchone():
                title = content[:36] if role == "user" else "Cuộc trò chuyện mới"
                conn.execute(
                    "INSERT INTO chat_sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
                    (session_id, title, now, now),
                )
            else:
                # Update session timestamp
                conn.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", (now, session_id))

            conn.execute(
                """INSERT INTO chat_messages
                   (message_id, session_id, role, content, status, sources, request_id, index_version, generation_mode, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (message_id, session_id, role, content, status, sources_json,
                 request_id, index_version, generation_mode, now),
            )
            conn.commit()

        return {
            "message_id": message_id,
            "session_id": session_id,
            "role": role,
            "content": content,
            "status": status,
            "sources": sources or [],
            "request_id": request_id,
            "index_version": index_version,
            "generation_mode": generation_mode,
            "created_at": now,
            "timestamp": now,
        }

    def _fetch_messages(self, session_id: str, conn: sqlite3.Connection) -> list[dict[str, Any]]:
        cur = conn.execute(
            "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,),
        )
        messages = []
        for r in cur.fetchall():
            m = dict(r)
            m["timestamp"] = m["created_at"]
            if m.get("sources"):
                try:
                    m["sources"] = json.loads(m["sources"])
                except Exception:
                    m["sources"] = []
            else:
                m["sources"] = []
            messages.append(m)
        return messages

    def get_messages(self, session_id: str) -> list[dict[str, Any]]:
        with self.connection() as conn:
            return self._fetch_messages(session_id, conn)

    def delete_message(self, message_id: str) -> bool:
        with self.connection() as conn:
            cur = conn.execute("DELETE FROM chat_messages WHERE message_id = ?", (message_id,))
            conn.commit()
            return cur.rowcount > 0

    # --- Feedback Operations ---

    def create_feedback(self, feedback_id: str, message_id: str, rating: str,
                        comment: str | None = None, session_id: str | None = None) -> dict[str, Any]:
        now = utc_now_iso()
        with self.connection() as conn:
            conn.execute(
                """INSERT INTO feedbacks (feedback_id, message_id, session_id, rating, comment, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (feedback_id, message_id, session_id, rating, comment, now),
            )
            conn.commit()
        return {
            "feedback_id": feedback_id,
            "message_id": message_id,
            "session_id": session_id,
            "rating": rating,
            "comment": comment,
            "created_at": now,
            "status": "recorded",
        }

    def list_feedbacks(self, limit: int = 100, offset: int = 0) -> tuple[list[dict[str, Any]], int]:
        with self.connection() as conn:
            count_cur = conn.execute("SELECT COUNT(*) FROM feedbacks")
            total = count_cur.fetchone()[0]
            cur = conn.execute(
                "SELECT * FROM feedbacks ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            )
            rows = [dict(r) for r in cur.fetchall()]
            return rows, total

    def get_feedback(self, feedback_id: str) -> dict[str, Any] | None:
        with self.connection() as conn:
            cur = conn.execute("SELECT * FROM feedbacks WHERE feedback_id = ?", (feedback_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def delete_feedback(self, feedback_id: str) -> bool:
        with self.connection() as conn:
            cur = conn.execute("DELETE FROM feedbacks WHERE feedback_id = ?", (feedback_id,))
            conn.commit()
            return cur.rowcount > 0

    # --- Document Knowledge Base Operations ---

    def create_document(self, doc_data: dict[str, Any]) -> dict[str, Any]:
        now = utc_now_iso()
        doc = {
            "document_id": doc_data["document_id"],
            "title": doc_data["title"],
            "category": doc_data.get("category", "academic"),
            "source_url": doc_data.get("source_url"),
            "applicable_year": doc_data.get("applicable_year"),
            "issue_date": doc_data.get("issue_date") or now[:10],
            "version": doc_data.get("version", "v1.0"),
            "status": doc_data.get("status", "processing"),
            "chunks_count": doc_data.get("chunks_count", 0),
            "size_mb": doc_data.get("size_mb", 0.0),
            "file_path": doc_data.get("file_path"),
            "created_at": doc_data.get("created_at") or now,
            "updated_at": now,
        }
        with self.connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO documents (
                    document_id, title, category, source_url, applicable_year,
                    issue_date, version, status, chunks_count, size_mb,
                    file_path, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    doc["document_id"], doc["title"], doc["category"],
                    doc["source_url"], doc["applicable_year"], doc["issue_date"],
                    doc["version"], doc["status"], doc["chunks_count"],
                    doc["size_mb"], doc["file_path"], doc["created_at"],
                    doc["updated_at"],
                ),
            )
            conn.commit()
        return doc

    def get_document(self, document_id: str) -> dict[str, Any] | None:
        with self.connection() as conn:
            cur = conn.execute("SELECT * FROM documents WHERE document_id = ?", (document_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def list_documents(
        self,
        category: str | None = None,
        status: str | None = None,
        search: str | None = None,
    ) -> list[dict[str, Any]]:
        query = "SELECT * FROM documents WHERE 1=1"
        params: list[Any] = []
        if category and category != "all":
            query += " AND category = ?"
            params.append(category)
        if status and status != "all":
            query += " AND status = ?"
            params.append(status)
        if search:
            query += " AND (title LIKE ? OR document_id LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])
        query += " ORDER BY updated_at DESC"

        with self.connection() as conn:
            cur = conn.execute(query, params)
            return [dict(r) for r in cur.fetchall()]

    def update_document(self, document_id: str, **kwargs) -> dict[str, Any] | None:
        doc = self.get_document(document_id)
        if not doc:
            return None
        now = utc_now_iso()
        fields = []
        params = []
        for k, v in kwargs.items():
            if k in doc and k not in {"document_id", "created_at"}:
                fields.append(f"{k} = ?")
                params.append(v)
        fields.append("updated_at = ?")
        params.append(now)
        params.append(document_id)

        with self.connection() as conn:
            conn.execute(f"UPDATE documents SET {', '.join(fields)} WHERE document_id = ?", params)
            conn.commit()
        return self.get_document(document_id)

    def delete_document(self, document_id: str) -> bool:
        with self.connection() as conn:
            cur = conn.execute("DELETE FROM documents WHERE document_id = ?", (document_id,))
            conn.commit()
            return cur.rowcount > 0

    # --- Indexing Job Operations ---

    def create_job(self, job_data: dict[str, Any]) -> dict[str, Any]:
        now = utc_now_iso()
        job = {
            "job_id": job_data["job_id"],
            "document_id": job_data["document_id"],
            "title": job_data["title"],
            "status": job_data.get("status", "processing"),
            "progress": job_data.get("progress", 0),
            "index_version": job_data.get("index_version"),
            "error_message": job_data.get("error_message"),
            "created_at": job_data.get("created_at") or now,
            "updated_at": now,
        }
        with self.connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO indexing_jobs (
                    job_id, document_id, title, status, progress,
                    index_version, error_message, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    job["job_id"], job["document_id"], job["title"],
                    job["status"], job["progress"], job["index_version"],
                    job["error_message"], job["created_at"], job["updated_at"],
                ),
            )
            conn.commit()
        return job

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        with self.connection() as conn:
            cur = conn.execute("SELECT * FROM indexing_jobs WHERE job_id = ?", (job_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def list_jobs(self, limit: int = 20) -> list[dict[str, Any]]:
        with self.connection() as conn:
            cur = conn.execute("SELECT * FROM indexing_jobs ORDER BY created_at DESC LIMIT ?", (limit,))
            return [dict(r) for r in cur.fetchall()]

    def update_job(self, job_id: str, **kwargs) -> dict[str, Any] | None:
        job = self.get_job(job_id)
        if not job:
            return None
        now = utc_now_iso()
        fields = []
        params = []
        for k, v in kwargs.items():
            if k in job and k not in {"job_id", "created_at"}:
                fields.append(f"{k} = ?")
                params.append(v)
        fields.append("updated_at = ?")
        params.append(now)
        params.append(job_id)

        with self.connection() as conn:
            conn.execute(f"UPDATE indexing_jobs SET {', '.join(fields)} WHERE job_id = ?", params)
            conn.commit()
        return self.get_job(job_id)


SQLiteStorage = Database

