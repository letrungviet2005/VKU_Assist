from abc import ABC, abstractmethod
from typing import Any


class BaseStorage(ABC):
    """Abstract Base Class for VKU Assist Persistence Layer.
    
    Provides standardized storage interface for sessions, messages, and feedback,
    supporting pluggable backends (SQLite, DynamoDB, etc.).
    """

    # --- Session Operations ---

    @abstractmethod
    def create_session(
        self,
        session_id: str,
        title: str = "Cuộc trò chuyện mới",
        session_token: str | None = None,
    ) -> dict[str, Any]:
        """Create a new chat session."""
        pass

    @abstractmethod
    def get_session(
        self,
        session_id: str,
        include_messages: bool = True,
    ) -> dict[str, Any] | None:
        """Retrieve a session by its ID, optionally including its messages."""
        pass

    @abstractmethod
    def list_sessions(
        self,
        session_token: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        """List sessions ordered by last updated timestamp, returning (items, total_count)."""
        pass

    @abstractmethod
    def update_session(
        self,
        session_id: str,
        title: str | None = None,
    ) -> dict[str, Any] | None:
        """Update session attributes (such as title) and touch updated_at."""
        pass

    @abstractmethod
    def delete_session(self, session_id: str) -> bool:
        """Delete a session and all its associated messages (cascade delete)."""
        pass

    @abstractmethod
    def clear_sessions(self, session_token: str | None = None) -> int:
        """Delete all sessions, optionally filtered by user session_token. Returns deleted count."""
        pass

    # --- Message Operations ---

    @abstractmethod
    def add_message(
        self,
        message_id: str,
        session_id: str,
        role: str,
        content: str,
        status: str | None = None,
        sources: list[dict] | None = None,
        request_id: str | None = None,
        index_version: str | None = None,
        generation_mode: str | None = None,
        created_at: str | None = None,
    ) -> dict[str, Any]:
        """Append a message to a session. Auto-creates session if not yet existing."""
        pass

    @abstractmethod
    def get_messages(self, session_id: str) -> list[dict[str, Any]]:
        """Retrieve all messages in a session in chronological order."""
        pass

    @abstractmethod
    def delete_message(self, message_id: str) -> bool:
        """Delete a single message by ID."""
        pass

    # --- Feedback Operations ---

    @abstractmethod
    def create_feedback(
        self,
        feedback_id: str,
        message_id: str,
        rating: str,
        comment: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """Record user feedback (helpful / not_helpful) for an AI response."""
        pass

    @abstractmethod
    def list_feedbacks(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        """List feedback items ordered by creation time descending, returning (items, total)."""
        pass

    @abstractmethod
    def get_feedback(self, feedback_id: str) -> dict[str, Any] | None:
        """Retrieve a specific feedback entry by ID."""
        pass

    @abstractmethod
    def delete_feedback(self, feedback_id: str) -> bool:
        """Delete a feedback entry by ID."""
        pass

    # --- Document Knowledge Base Operations ---

    @abstractmethod
    def create_document(self, doc_data: dict[str, Any]) -> dict[str, Any]:
        """Record a knowledge document in the administrative repository."""
        pass

    @abstractmethod
    def get_document(self, document_id: str) -> dict[str, Any] | None:
        """Retrieve a specific document by its ID."""
        pass

    @abstractmethod
    def list_documents(
        self,
        category: str | None = None,
        status: str | None = None,
        search: str | None = None,
    ) -> list[dict[str, Any]]:
        """List knowledge documents with optional category, status, or title filters."""
        pass

    @abstractmethod
    def update_document(self, document_id: str, **kwargs) -> dict[str, Any] | None:
        """Update document metadata or indexing status."""
        pass

    @abstractmethod
    def delete_document(self, document_id: str) -> bool:
        """Delete a document record from the registry."""
        pass

    # --- Indexing Job Operations ---

    @abstractmethod
    def create_job(self, job_data: dict[str, Any]) -> dict[str, Any]:
        """Record a new background indexing worker job."""
        pass

    @abstractmethod
    def get_job(self, job_id: str) -> dict[str, Any] | None:
        """Retrieve background indexing job status by ID."""
        pass

    @abstractmethod
    def list_jobs(self, limit: int = 20) -> list[dict[str, Any]]:
        """List recent background worker jobs."""
        pass

    @abstractmethod
    def update_job(self, job_id: str, **kwargs) -> dict[str, Any] | None:
        """Update job progress, status, or index version."""
        pass

    # --- Lifecycle ---

    @abstractmethod
    def close(self) -> None:
        """Release underlying connections or resources."""
        pass
