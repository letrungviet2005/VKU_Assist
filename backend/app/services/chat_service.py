import json
import logging
import re
from time import perf_counter

from pydantic import ValidationError

from app.core.errors import ServiceError
from app.rag.prompts import build_prompt, SYSTEM_PROMPT
from app.schemas.chat import ChatOutput, ModelAnswer, Source


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
