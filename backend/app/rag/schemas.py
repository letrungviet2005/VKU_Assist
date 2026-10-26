from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

Category = Literal["admissions", "academic"]


class Document(BaseModel):
    model_config = ConfigDict(extra="forbid")
    file: str = Field(min_length=1)
    document_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    source_url: HttpUrl
    category: Category
    applicable_year: int | None = Field(default=None, ge=1900, le=2200)
    document_version: str = Field(min_length=1)


class Chunk(BaseModel):
    model_config = ConfigDict(extra="forbid")
    chunk_id: str
    document_id: str
    text: str = Field(min_length=1)
    title: str
    source_url: HttpUrl
    page_or_section: int | str | None
    category: Category
    applicable_year: int | None
    document_version: str
    content_hash: str
    indexed_at: str


class SearchInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query: str = Field(min_length=1, max_length=2000)
    top_k: int | None = Field(default=None, ge=1, le=10)
    category: Category | None = None
    applicable_year: int | None = Field(default=None, ge=1900, le=2200)

    @field_validator("query")
    @classmethod
    def nonblank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("query must not be blank")
        return value
