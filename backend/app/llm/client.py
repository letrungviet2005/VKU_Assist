"""Small sync adapter contract. Client creation is deferred until generation."""
from dataclasses import dataclass, field
import json
import re
from threading import Lock
from typing import Protocol

from app.core.errors import ServiceError
from app.rag.prompts import Prompt

_WORD_RE = re.compile(r"\w+", re.UNICODE)


@dataclass
class Generation:
    text: str
    usage: dict[str, int] = field(default_factory=dict)


class AnswerGenerator(Protocol):
    def generate(self, prompt: Prompt) -> Generation: ...


def configuration_error(settings) -> str | None:
    if not settings.chat_enabled:
        return "chat_disabled"
    if settings.llm_provider == "fake":
        return None if settings.app_env in {"development", "test"} else "fake_not_allowed"
    if settings.llm_provider == "extractive":
        return None
    if (not re.fullmatch(r"[a-z]{2}(?:-[a-z]+)+-\d+", settings.bedrock_region)
            or not settings.bedrock_model_id or len(settings.bedrock_model_id) > 2048
            or re.search(r"\s", settings.bedrock_model_id)):
        return "chat_not_configured"
    return None


class FakeAdapter:
    def __init__(self, settings):
        if settings.app_env not in {"development", "test"}:
            raise ServiceError(503, "fake_not_allowed", "Fake chỉ được dùng trong development/test.")

    def generate(self, prompt: Prompt) -> Generation:
        # This does not infer facts from the question or documents.
        source = prompt.source_ids[0]
        return Generation(json.dumps({
            "status": "answered",
            "answer": f"FAKE — KIỂM THỬ: Đây là phản hồi giả lập để kiểm tra luồng dẫn nguồn [{source}]. Không phải câu trả lời từ model thật hoặc thông tin chính thức VKU.",
            "cited_source_ids": [source],
        }, ensure_ascii=False))


class ExtractiveAdapter:
    """Local RAG extractive synthesizer requiring zero external LLM API keys.

    Strictly formats retrieved document passages with exact [S1], [S2] citations
    while obeying all JSON schema and anti-leak rules of validate_answer().
    """

    def __init__(self, settings):
        self.settings = settings

    @staticmethod
    def _clean_passage(text: str) -> str:
        # Strip any brackets/URLs to prevent validate_answer rejection while keeping exact facts
        cleaned = re.sub(r"https?://\S+", "", text or "")
        cleaned = cleaned.replace("[", "(").replace("]", ")")
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned

    def generate(self, prompt: Prompt) -> Generation:
        payload = json.loads(prompt.user)
        question = payload.get("question", "")
        docs = payload.get("documents", [])
        if not docs:
            return Generation(json.dumps({
                "status": "insufficient_evidence",
                "answer": "Chưa tìm thấy đoạn tài liệu phù hợp trong chỉ mục hiện tại để trả lời câu hỏi này.",
                "cited_source_ids": [],
            }, ensure_ascii=False))

        q_terms = {t for t in _WORD_RE.findall(question.lower()) if len(t) > 1 or t.isdigit()}
        ranked = []
        for idx, doc in enumerate(docs):
            hay = f"{doc.get('title', '')} {doc.get('page_or_section', '')} {doc.get('text', '')}".lower()
            overlap = sum(1 for t in q_terms if t in hay)
            ranked.append((overlap, -idx, doc))
        ranked.sort(reverse=True)

        selected = [item[2] for item in ranked[:3]]
        cited_ids = [d["source_id"] for d in selected]

        lines = ["Dựa trên nội dung trích xuất trực tiếp từ tài liệu VKU đã lập chỉ mục:\n"]
        for d in selected:
            sid = d["source_id"]
            title = self._clean_passage(d.get("title", "Văn bản VKU"))
            section = self._clean_passage(str(d.get("page_or_section") or ""))
            year = d.get("applicable_year")
            excerpt = self._clean_passage(d.get("text", ""))
            if len(excerpt) > 420:
                excerpt = excerpt[:417].rstrip() + "..."
            meta_parts = [p for p in [section, f"Năm {year}" if year else ""] if p]
            meta_str = f" ({' · '.join(meta_parts)})" if meta_parts else ""
            lines.append(f"- **{title}**{meta_str} [{sid}]:\n  {excerpt}")

        return Generation(json.dumps({
            "status": "answered",
            "answer": "\n\n".join(lines),
            "cited_source_ids": cited_ids,
        }, ensure_ascii=False))


class BedrockAdapter:
    def __init__(self, settings, client=None):
        self.settings = settings
        self._client = client
        self._lock = Lock()

    def _get_client(self):
        with self._lock:
            if self._client is None:
                import boto3
                from botocore.config import Config

                session = boto3.Session(profile_name=self.settings.bedrock_aws_profile or None)
                self._client = session.client(
                    "bedrock-runtime", region_name=self.settings.bedrock_region,
                    config=Config(connect_timeout=self.settings.llm_connect_timeout,
                                  read_timeout=self.settings.llm_read_timeout,
                                  retries={"mode": "standard", "total_max_attempts": 1}),
                )
            return self._client

    def generate(self, prompt: Prompt) -> Generation:
        from botocore.exceptions import (
            BotoCoreError, ClientError, ConnectTimeoutError, ReadTimeoutError,
            NoCredentialsError, PartialCredentialsError, ProfileNotFound,
        )

        try:
            response = self._get_client().converse(
                modelId=self.settings.bedrock_model_id,
                system=[{"text": prompt.system}],
                messages=[{"role": "user", "content": [{"text": prompt.user}]}],
                inferenceConfig={"maxTokens": self.settings.llm_max_output_tokens},
            )
        except (ConnectTimeoutError, ReadTimeoutError):
            raise ServiceError(504, "bedrock_timeout", "Dịch vụ sinh câu trả lời quá thời gian chờ.") from None
        except (NoCredentialsError, PartialCredentialsError, ProfileNotFound):
            raise ServiceError(503, "bedrock_credentials_unavailable", "Chưa có thông tin xác thực Bedrock hợp lệ.") from None
        except ClientError as error:
            code = error.response.get("Error", {}).get("Code", "")
            if code in {"ThrottlingException", "ServiceQuotaExceededException", "TooManyRequestsException"}:
                mapped = (503, "bedrock_quota_exceeded", "Bedrock đang giới hạn lưu lượng hoặc quota.")
            elif code in {"AccessDeniedException", "UnauthorizedException", "UnrecognizedClientException", "ExpiredTokenException", "InvalidSignatureException"}:
                mapped = (503, "bedrock_access_denied", "Chưa có quyền hoặc xác thực để gọi model Bedrock.")
            elif code == "ModelTimeoutException":
                mapped = (504, "bedrock_timeout", "Model Bedrock quá thời gian chờ.")
            elif code in {"ValidationException", "ResourceNotFoundException"}:
                mapped = (503, "bedrock_configuration_error", "Cấu hình model hoặc yêu cầu Bedrock chưa phù hợp.")
            else:
                mapped = (503, "bedrock_unavailable", "Bedrock tạm thời không khả dụng.")
            raise ServiceError(*mapped) from None
        except BotoCoreError:
            raise ServiceError(503, "bedrock_unavailable", "Không thể kết nối Bedrock.") from None

        try:
            # No tools/native JSON schema: request plain JSON text and validate ourselves.
            if response["stopReason"] != "end_turn":
                raise ValueError("Truncated/refused/unexpected response")
            if response["output"]["message"]["role"] != "assistant":
                raise ValueError("Expected assistant response")
            blocks = response["output"]["message"]["content"]
            if not blocks or any(set(block) != {"text"} for block in blocks):
                raise ValueError("Expected text-only response")
            text = "".join(block["text"] for block in blocks)
            if not text or len(text) > 40000:
                raise ValueError("Invalid response length")
            usage = {key: value for key, value in response.get("usage", {}).items()
                     if key in {"inputTokens", "outputTokens", "totalTokens"} and type(value) is int and value >= 0}
            return Generation(text, usage)
        except (KeyError, TypeError, ValueError, AttributeError):
            raise ServiceError(502, "invalid_llm_response", "Phản hồi model không hợp lệ; chưa thể cung cấp câu trả lời.") from None


def create_adapter(settings) -> AnswerGenerator:
    if settings.llm_provider == "fake":
        return FakeAdapter(settings)
    if settings.llm_provider == "extractive":
        return ExtractiveAdapter(settings)
    return BedrockAdapter(settings)
