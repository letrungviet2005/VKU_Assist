from fastapi import APIRouter, Request

from app.core.errors import ErrorEnvelope, ServiceError
from app.schemas.chat import ChatInput, ChatOutput

router = APIRouter(tags=["chat"], responses={
    status: {"model": ErrorEnvelope} for status in (422, 429, 502, 503, 504)
})


@router.post("/api/chat", response_model=ChatOutput)
def chat(body: ChatInput, request: Request):
    """Sync route runs in FastAPI's worker pool. Slots track actual running work."""
    state = request.app.state
    if len(body.message) > state.settings.chat_max_message_chars:
        raise ServiceError(422, "message_too_long", "Câu hỏi vượt giới hạn độ dài đã cấu hình.")
    if state.chat_reason:
        raise ServiceError(503, state.chat_reason, "Chat chưa được bật hoặc cấu hình hợp lệ.")
    snapshot = state.retriever
    if snapshot is None:
        raise ServiceError(503, state.retrieval_reason, "Phần truy xuất chưa sẵn sàng.")
    if not state.chat_slots.acquire(blocking=False):
        raise ServiceError(429, "chat_concurrency_exceeded", "Đang có quá nhiều yêu cầu hỏi đáp. Vui lòng thử lại sau.")
    try:
        return state.chat_service.answer(body, snapshot, request.state.request_id, request.state.message_id)
    finally:
        # Never release a slot from an async timeout while the boto3 worker is still running.
        state.chat_slots.release()
