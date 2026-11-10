from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class FeedbackCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message_id: str = Field(min_length=1, max_length=100)
    rating: Literal["helpful", "not_helpful"]
    comment: str | None = Field(default=None, max_length=2000)
    session_id: str | None = Field(default=None, max_length=100)


class FeedbackResponse(BaseModel):
    feedback_id: str
    message_id: str
    session_id: str | None = None
    rating: Literal["helpful", "not_helpful"]
    comment: str | None = None
    created_at: str
    status: str = "recorded"


class FeedbackListResponse(BaseModel):
    items: list[FeedbackResponse]
    total: int
