from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class MessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant", "system"]
    content: str = Field(min_length=1, max_length=32000)
    status: str | None = None
    sources: list[dict[str, Any]] | None = None
    message_id: str | None = None
    request_id: str | None = None
    index_version: str | None = None
    generation_mode: str | None = None


class MessageResponse(BaseModel):
    message_id: str
    session_id: str
    role: str
    content: str
    status: str | None = None
    sources: list[dict[str, Any]] = []
    request_id: str | None = None
    index_version: str | None = None
    generation_mode: str | None = None
    created_at: str
    timestamp: str | None = None


class SessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str | None = None
    title: str | None = Field(default="Cuộc trò chuyện mới", max_length=200)
    session_token: str | None = None


class SessionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=200)


class SessionResponse(BaseModel):
    id: str
    title: str
    session_token: str | None = None
    created_at: str
    updated_at: str
    createdAt: str | None = None
    updatedAt: str | None = None
    message_count: int = 0


class SessionDetailResponse(BaseModel):
    id: str
    title: str
    session_token: str | None = None
    created_at: str
    updated_at: str
    createdAt: str | None = None
    updatedAt: str | None = None
    messages: list[MessageResponse] = []


class SessionListResponse(BaseModel):
    sessions: list[SessionResponse]
    total: int
