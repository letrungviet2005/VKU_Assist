from uuid import uuid4
from fastapi import APIRouter, Query, Request, status

from app.core.errors import ErrorEnvelope, ServiceError
from app.schemas.session import (
    MessageCreate,
    MessageResponse,
    SessionCreate,
    SessionDetailResponse,
    SessionListResponse,
    SessionResponse,
    SessionUpdate,
)

router = APIRouter(prefix="/api/sessions", tags=["sessions"], responses={
    status: {"model": ErrorEnvelope} for status in (404, 422, 500)
})


def get_db(request: Request):
    """Retrieve database instance from app state."""
    db = getattr(request.app.state, "db", None)
    if db is None:
        raise ServiceError(500, "database_unavailable", "Cơ sở dữ liệu chưa sẵn sàng.")
    return db


@router.post("", response_model=SessionDetailResponse, status_code=status.HTTP_201_CREATED)
def create_session(body: SessionCreate, request: Request):
    """Create a new chat session."""
    db = get_db(request)
    session_id = body.id or f"session_{uuid4().hex[:12]}"
    title = body.title or "Cuộc trò chuyện mới"
    created = db.create_session(session_id=session_id, title=title, session_token=body.session_token)
    return created


@router.get("", response_model=SessionListResponse)
def list_sessions(
    request: Request,
    session_token: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """List sessions, ordered by most recently updated."""
    db = get_db(request)
    sessions, total = db.list_sessions(session_token=session_token, limit=limit, offset=offset)
    return {"sessions": sessions, "total": total}


@router.get("/{session_id}", response_model=SessionDetailResponse)
def get_session(session_id: str, request: Request):
    """Get session details including its messages."""
    db = get_db(request)
    session_data = db.get_session(session_id, include_messages=True)
    if not session_data:
        raise ServiceError(404, "session_not_found", f"Không tìm thấy phiên hội thoại '{session_id}'.")
    return session_data


@router.patch("/{session_id}", response_model=SessionDetailResponse)
def update_session(session_id: str, body: SessionUpdate, request: Request):
    """Update session title."""
    db = get_db(request)
    updated = db.update_session(session_id, title=body.title)
    if not updated:
        raise ServiceError(404, "session_not_found", f"Không tìm thấy phiên hội thoại '{session_id}'.")
    return updated


@router.delete("/{session_id}")
def delete_session(session_id: str, request: Request):
    """Delete a session and all its messages."""
    db = get_db(request)
    deleted = db.delete_session(session_id)
    if not deleted:
        raise ServiceError(404, "session_not_found", f"Không tìm thấy phiên hội thoại '{session_id}'.")
    return {"status": "deleted", "id": session_id}


@router.delete("")
def clear_sessions(request: Request, session_token: str | None = Query(default=None)):
    """Clear all sessions (optionally filtered by session token)."""
    db = get_db(request)
    count = db.clear_sessions(session_token=session_token)
    return {"status": "cleared", "deleted_count": count}


@router.get("/{session_id}/messages", response_model=list[MessageResponse])
def get_session_messages(session_id: str, request: Request):
    """Get all messages in a session."""
    db = get_db(request)
    session_data = db.get_session(session_id, include_messages=False)
    if not session_data:
        raise ServiceError(404, "session_not_found", f"Không tìm thấy phiên hội thoại '{session_id}'.")
    return db.get_messages(session_id)


@router.post("/{session_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def add_message_to_session(session_id: str, body: MessageCreate, request: Request):
    """Add a message to a session."""
    db = get_db(request)
    message_id = body.message_id or f"msg_{uuid4().hex[:12]}"
    added = db.add_message(
        message_id=message_id,
        session_id=session_id,
        role=body.role,
        content=body.content,
        status=body.status,
        sources=body.sources,
        request_id=body.request_id,
        index_version=body.index_version,
        generation_mode=body.generation_mode,
    )
    return added
