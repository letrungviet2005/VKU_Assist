from uuid import uuid4
from fastapi import APIRouter, Query, Request, status

from app.core.errors import ErrorEnvelope, ServiceError
from app.schemas.feedback import FeedbackCreate, FeedbackListResponse, FeedbackResponse

router = APIRouter(prefix="/api/feedback", tags=["feedback"], responses={
    status: {"model": ErrorEnvelope} for status in (404, 422, 500)
})


def get_db(request: Request):
    """Retrieve database instance from app state."""
    db = getattr(request.app.state, "db", None)
    if db is None:
        raise ServiceError(500, "database_unavailable", "Cơ sở dữ liệu chưa sẵn sàng.")
    return db


@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
def submit_feedback(body: FeedbackCreate, request: Request):
    """Submit user feedback for an AI response."""
    db = get_db(request)
    feedback_id = f"fb_{uuid4().hex[:12]}"
    created = db.create_feedback(
        feedback_id=feedback_id,
        message_id=body.message_id,
        rating=body.rating,
        comment=body.comment,
        session_id=body.session_id,
    )
    return created


@router.get("", response_model=FeedbackListResponse)
def list_feedback(
    request: Request,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """List all user feedback entries (for admin and evaluation)."""
    db = get_db(request)
    items, total = db.list_feedbacks(limit=limit, offset=offset)
    return {"items": items, "total": total}


@router.delete("/{feedback_id}")
def delete_feedback(feedback_id: str, request: Request):
    """Delete a feedback entry by ID."""
    db = get_db(request)
    deleted = db.delete_feedback(feedback_id)
    if not deleted:
        raise ServiceError(404, "feedback_not_found", f"Không tìm thấy phản hồi '{feedback_id}'.")
    return {"status": "deleted", "id": feedback_id}
