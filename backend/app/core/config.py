from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = Field(default="VKU Assist", min_length=1)
    app_env: Literal["development", "test", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    retrieval_enabled: bool = False
    embedding_model: str = "intfloat/multilingual-e5-small"
    embedding_revision: str = "main"
    model_cache: Path = Path(".model-cache")
    data_dir: Path = Path("data")
    index_dir: Path = Path("indexes")
    chunk_size: int = Field(default=300, ge=16, le=512)
    chunk_overlap: int = Field(default=50, ge=0)
    search_top_k: int = Field(default=5, ge=1, le=10)
    chat_enabled: bool = False
    llm_provider: Literal["bedrock", "fake"] = "bedrock"
    bedrock_region: str = ""
    bedrock_model_id: str = ""
    bedrock_aws_profile: str | None = None
    llm_connect_timeout: float = Field(default=5, gt=0, le=60)
    llm_read_timeout: float = Field(default=60, gt=0, le=300)
    llm_max_output_tokens: int = Field(default=1024, ge=64, le=8192)
    chat_max_message_chars: int = Field(default=2000, ge=1, le=2000)
    chat_max_context_chars: int = Field(default=12000, ge=1, le=100000)
    chat_max_concurrency: int = Field(default=2, ge=1, le=32)

    @model_validator(mode="after")
    def validate_chunking(self):
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("CHUNK_OVERLAP must be smaller than CHUNK_SIZE")
        return self

    @field_validator("cors_origins")
    @classmethod
    def validate_origins(cls, origins: list[str]) -> list[str]:
        from urllib.parse import urlsplit

        for origin in origins:
            parsed = urlsplit(origin)
            if (parsed.scheme not in {"http", "https"} or not parsed.netloc
                    or parsed.path or parsed.query or parsed.fragment
                    or parsed.username or parsed.password):
                raise ValueError("CORS origins must be HTTP(S) origins without paths or credentials")
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
