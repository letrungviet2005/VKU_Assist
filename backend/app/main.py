from contextlib import asynccontextmanager
import logging
from time import perf_counter
from threading import BoundedSemaphore
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException
from fastapi.exceptions import RequestValidationError

from app.api.health import router as health_router
from app.api.search import router as search_router
from app.api.chat import router as chat_router
from app.api.sessions import router as sessions_router
from app.api.feedback import router as feedback_router
from app.api.auth import router as auth_router
from app.api.documents import router as documents_router
from app.api.library import router as library_router
from app.storage import create_storage
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.rag.embeddings import ModelUnavailable
from app.core.errors import (ServiceError, error_response, service_error_handler,
                             validation_error_handler, http_error_handler)
from app.llm.client import configuration_error, create_adapter
from app.services.chat_service import ChatService
from app.services.document_service import DocumentService

def create_app(settings=None, retriever_factory=None, adapter_factory=None):
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    logger = logging.getLogger("app.requests")

    @asynccontextmanager
    async def lifespan(app):
        if settings.retrieval_enabled:
            try:
                from app.rag.retriever import Retriever

                app.state.retriever = (retriever_factory or Retriever)(settings)
                app.state.retrieval_reason = None
            except FileNotFoundError:
                app.state.retrieval_reason = "retrieval_index_missing"
            except ModelUnavailable:
                app.state.retrieval_reason = "retrieval_model_unavailable"
            except Exception:
                app.state.retrieval_reason = "retrieval_load_failed"
            if app.state.retriever is None:
                logging.getLogger("app.retrieval").error(app.state.retrieval_reason)
        yield
        app.state.retriever = None

    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.state.settings = settings
    app.state.db = create_storage(settings)
    app.state.retriever = None
    app.state.retrieval_reason = "retrieval_not_initialized"
    app.state.chat_reason = configuration_error(settings)
    app.state.chat_service = None
    app.state.chat_slots = BoundedSemaphore(settings.chat_max_concurrency)
    if app.state.chat_reason is None:
        # Adapter construction does not create a boto3 client or resolve credentials.
        app.state.chat_service = ChatService(settings, (adapter_factory or create_adapter)(settings))
    app.state.document_service = DocumentService(settings, app.state.db)
    app.add_exception_handler(ServiceError, service_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(HTTPException, http_error_handler)
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-Request-ID", "Authorization"],
        expose_headers=["X-Request-ID"],
    )

    @app.middleware("http")
    async def log_request(request: Request, call_next):
        request_id = str(uuid4())
        request.state.request_id = request_id
        if request.url.path in {"/api/chat", "/api/chat/stream"}:
            request.state.message_id = str(uuid4())
        started = perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception:
            response = error_response(request, 500, "internal_error", "Lỗi xử lý nội bộ.")
        finally:
            logger.info("request_completed", extra={
                "request_id": request_id, "method": request.method,
                "path": request.url.path, "status_code": status_code,
                "duration_ms": round((perf_counter() - started) * 1000, 2),
                "message_id": getattr(request.state, "message_id", None),
                "error_code": getattr(request.state, "error_code", None),
            })
        response.headers["X-Request-ID"] = request_id
        return response

    app.include_router(health_router)
    app.include_router(chat_router)
    app.include_router(sessions_router)
    app.include_router(feedback_router)
    app.include_router(auth_router)
    app.include_router(documents_router)
    app.include_router(library_router)
    if settings.app_env == "development":
        app.include_router(search_router)
    return app


app = create_app()
