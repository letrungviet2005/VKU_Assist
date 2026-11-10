import inspect
import json
import logging
import re
from time import perf_counter
from typing import Iterator

from pydantic import ValidationError

from app.core.errors import ServiceError
from app.rag.prompts import build_prompt, SYSTEM_PROMPT
from app.schemas.chat import ChatOutput, ModelAnswer, Source

_FOLLOWUP_HINTS = (
    "còn",
    "thế còn",
    "vậy",
    "năm đó",
    "ngành đó",
    "điều kiện đó",
    "chi tiết",
    "cụ thể",
    "trường hợp",
    "nếu vậy",
    "bao nhiêu",
)


def select_context(results: list[dict], budget: int) -> tuple[list[dict], dict[str, dict]]:
    contexts, sources = [], {}
    for chunk in results:
        source_id = f"S{len(contexts) + 1}"
        context = {"source_id": source_id, "text": chunk["text"], "title": chunk["title"],
                   "category": chunk["category"], "applicable_year": chunk["applicable_year"],
                   "document_version": chunk["document_version"], "page_or_section": chunk["page_or_section"]}
        # Count serialized metadata too; keep whole chunks so citations refer to intact evidence.
        if len(json.dumps([*contexts, context], ensure_ascii=False)) > budget:
            continue
        contexts.append(context)
        sources[source_id] = chunk
    return contexts, sources


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def validate_answer(text: str, allowed: dict[str, dict]) -> ModelAnswer:
    try:
        if len(text) > 40000:
            raise ValueError("Response too large")
        parsed = ModelAnswer.model_validate(json.loads(text, object_pairs_hook=unique_object))
        cited = set(parsed.cited_source_ids)
        inline = set(re.findall(r"\[([^\[\]\r\n]+)\]", parsed.answer))
        without_citations = re.sub(r"\[S[1-9][0-9]*\]", "", parsed.answer)
        if (not parsed.answer.strip() or len(cited) != len(parsed.cited_source_ids)
                or not cited.issubset(allowed) or inline != cited
                or "[" in without_citations or "]" in without_citations
                or re.search(r"https?://|www\.|\]\(", parsed.answer, re.IGNORECASE)
                or re.search(r"[A-Za-z]:[\\/]|/(?:home|app|Users|etc|var|tmp)/", parsed.answer)
                or SYSTEM_PROMPT.strip() in parsed.answer
                or (parsed.status == "answered" and not cited)):
            raise ValueError("Invalid citations or answer")
        return parsed
    except (ValidationError, ValueError, TypeError):
        raise ServiceError(502, "invalid_llm_response", "Phản hồi model không hợp lệ; chưa thể cung cấp câu trả lời.") from None


def condense_query(message: str, history: list | None, max_chars: int = 2000) -> str:
    """Combine short follow-up questions with recent user context for multi-turn retrieval."""
    clean_msg = message.strip()
    if not history:
        return clean_msg
    user_turns = [turn.content.strip() for turn in history if getattr(turn, "role", None) == "user" and turn.content.strip()]
    if not user_turns:
        return clean_msg
    lowered = clean_msg.lower()
    is_followup = len(clean_msg) < 48 or any(hint in lowered for hint in _FOLLOWUP_HINTS)
    if not is_followup:
        return clean_msg
    prev_topic = user_turns[-1][:240]
    combined = f"{prev_topic} — {clean_msg}"
    return combined[:max_chars]


def build_followup_suggestions(status: str, sources: list[dict]) -> list[str]:
    """Generate contextual follow-up prompts derived strictly from retrieved document metadata."""
    if status == "needs_clarification":
        return [
            "Áp dụng cho năm 2026, khối ngành Công nghệ thông tin",
            "Áp dụng cho chương trình Chất lượng cao / Song ngữ",
        ]
    if not sources:
        return [
            "5 phương thức xét tuyển Đại học VKU năm 2026",
            "Quy chế đào tạo trình độ đại học hệ tín chỉ VKU",
        ]
    first = sources[0]
    cat = first.get("category")
    year = first.get("applicable_year")
    if cat == "admissions":
        return [
            f"Điều kiện học bổng tuyển sinh năm {year or 2026} như thế nào?",
            "Hồ sơ và các mốc thời gian nhập học cần lưu ý gì?",
        ]
    return [
        "Quy định ngưỡng điểm bị cảnh báo học vụ là bao nhiêu?",
        "Chuẩn đầu ra ngoại ngữ TOEIC và tin học để tốt nghiệp?",
    ]


def _format_sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


class ChatService:
    def __init__(self, settings, adapter):
        self.settings, self.adapter = settings, adapter

    def answer(self, body, retriever, request_id: str, message_id: str):
        # Caller captures this retriever once. Never read app.state again mid-request.
        version = retriever.version
        metrics = {"request_id": request_id, "message_id": message_id, "index_version": version,
                   "provider": self.settings.llm_provider,
                   "model": self.settings.bedrock_model_id if self.settings.llm_provider == "bedrock" else "fake",
                   "retrieval_ms": 0, "generation_ms": 0, "context_chunks": 0}
        started = perf_counter()
        try:
            try:
                results = retriever.search(body.message, self.settings.search_top_k,
                                           body.category, body.applicable_year)
            except ValueError:
                raise ServiceError(422, "message_exceeds_embedding_limit", "Câu hỏi vượt giới hạn token của model truy xuất.") from None
            finally:
                metrics["retrieval_ms"] = round((perf_counter() - started) * 1000, 2)
            contexts, mapping = select_context(results, self.settings.chat_max_context_chars)
            metrics["context_chunks"] = len(contexts)
            if not contexts:
                output = ChatOutput(message_id=message_id, request_id=request_id,
                    status="insufficient_evidence", answer="Chưa có tài liệu phù hợp trong phạm vi và giới hạn ngữ cảnh để trả lời. Bạn có thể làm rõ năm hoặc phạm vi cần tra cứu.",
                    sources=[], index_version=version, generation_mode=self.settings.llm_provider)
            else:
                started = perf_counter()
                try:
                    generation = self.adapter.generate(build_prompt(body.message, contexts))
                    metrics["token_usage"] = generation.usage
                finally:
                    metrics["generation_ms"] = round((perf_counter() - started) * 1000, 2)
                answer = validate_answer(generation.text, mapping)
                sources = []
                for source_id in answer.cited_source_ids:
                    chunk = mapping[source_id]
                    sources.append(Source(source_id=source_id, chunk_id=chunk["chunk_id"],
                        document_id=chunk["document_id"], title=chunk["title"], url=chunk["source_url"],
                        page_or_section=chunk["page_or_section"], applicable_year=chunk["applicable_year"],
                        document_version=chunk["document_version"]))
                output = ChatOutput(message_id=message_id, request_id=request_id,
                    status=answer.status, answer=answer.answer, sources=sources,
                    index_version=version, generation_mode=self.settings.llm_provider)
            metrics["outcome"] = output.status
            return output
        except ServiceError as error:
            metrics["error_code"] = error.code
            raise
        except Exception:
            metrics["error_code"] = "chat_internal_error"
            raise ServiceError(503, "chat_internal_error", "Tạm thời chưa thể xử lý câu hỏi.") from None
        finally:
            logging.getLogger("app.chat").info("chat_completed", extra=metrics)

    def _run_retrieval(self, search_query: str, body, retriever):
        sig = inspect.signature(retriever.search)
        kwargs = {}
        if "document_id" in sig.parameters and getattr(body, "document_id", None):
            kwargs["document_id"] = body.document_id
        if "hybrid" in sig.parameters:
            kwargs["hybrid"] = True
        return retriever.search(
            search_query,
            self.settings.search_top_k,
            body.category,
            body.applicable_year,
            **kwargs,
        )

    def stream_answer(self, body, retriever, request_id: str, message_id: str) -> Iterator[str]:
        """Validate retrieval & LLM JSON contract first, then stream SSE frames safely."""
        version = retriever.version
        search_query = condense_query(body.message, getattr(body, "history", None), self.settings.chat_max_message_chars)
        try:
            try:
                results = self._run_retrieval(search_query, body, retriever)
            except ValueError:
                yield _format_sse("error", {"code": "message_exceeds_embedding_limit", "message": "Câu hỏi vượt giới hạn token của model truy xuất.", "request_id": request_id})
                return

            contexts, mapping = select_context(results, self.settings.chat_max_context_chars)
            if not contexts:
                status = "insufficient_evidence"
                answer_text = "Chưa có tài liệu phù hợp trong phạm vi và giới hạn ngữ cảnh để trả lời. Bạn có thể làm rõ năm hoặc phạm vi cần tra cứu."
                sources_payload = []
            else:
                prompt_msg = search_query if search_query != body.message else body.message
                generation = self.adapter.generate(build_prompt(prompt_msg, contexts))
                validated = validate_answer(generation.text, mapping)
                status = validated.status
                answer_text = validated.answer
                sources_payload = []
                for source_id in validated.cited_source_ids:
                    chunk = mapping[source_id]
                    sources_payload.append({
                        "source_id": source_id,
                        "chunk_id": chunk["chunk_id"],
                        "document_id": chunk["document_id"],
                        "title": chunk["title"],
                        "url": chunk["source_url"],
                        "page_or_section": chunk["page_or_section"],
                        "applicable_year": chunk["applicable_year"],
                        "document_version": chunk["document_version"],
                        "snippet": chunk.get("text", "")[:320],
                    })

            followups = build_followup_suggestions(status, sources_payload)
            yield _format_sse("meta", {
                "message_id": message_id,
                "request_id": request_id,
                "status": status,
                "sources": sources_payload,
                "index_version": version,
                "generation_mode": self.settings.llm_provider,
                "followups": followups,
                "condensed_query": search_query if search_query != body.message else None,
            })

            # Stream text in clean multi-character slices preserving Markdown tokens
            chunk_size = 18
            for idx in range(0, len(answer_text), chunk_size):
                yield _format_sse("token", {"delta": answer_text[idx:idx + chunk_size]})

            yield _format_sse("done", {"ok": True, "status": status})
        except ServiceError as err:
            yield _format_sse("error", {"code": err.code, "message": err.message, "request_id": request_id})
        except Exception:
            yield _format_sse("error", {"code": "chat_internal_error", "message": "Tạm thời chưa thể xử lý câu hỏi.", "request_id": request_id})
