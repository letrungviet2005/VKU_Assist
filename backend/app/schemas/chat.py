from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.rag.schemas import Category

ChatStatus = Literal["answered", "needs_clarification", "insufficient_evidence"]


class ChatInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    message: str = Field(min_length=1, max_length=2000)
    category: Category | None = None
    applicable_year: int | None = Field(default=None, ge=1900, le=2200)

    @field_validator("message")
    @classmethod
    def nonblank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("message must contain text")
        return value


class ModelAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    status: ChatStatus
    answer: str = Field(min_length=1, max_length=32000)
    cited_source_ids: list[str] = Field(max_length=10)


class Source(BaseModel):
    source_id: str
    chunk_id: str
    document_id: str
    title: str
    url: str
    page_or_section: int | str | None
    applicable_year: int | None
    document_version: str


class ChatOutput(BaseModel):
    message_id: str
    request_id: str
    status: ChatStatus
    answer: str
    sources: list[Source]
    index_version: str
    generation_mode: Literal["bedrock", "fake"]
