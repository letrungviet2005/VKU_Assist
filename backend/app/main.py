from contextlib import asynccontextmanager
import logging
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from app.api.health import router as health_router
from app.api.search import router as search_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.rag.embeddings import ModelUnavailable

def create_app(settings=None, retriever_factory=None):
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
    app.state.retriever = None
    app.state.retrieval_reason = "retrieval_not_initialized"
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"], allow_headers=["Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )

    @app.middleware("http")
    async def log_request(request: Request, call_next):
        request_id = str(uuid4())
        request.state.request_id = request_id
        started = perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception:
            response = JSONResponse(status_code=500, content={"detail": "Internal Server Error"})
        finally:
            logger.info("request_completed", extra={
                "request_id": request_id, "method": request.method,
                "path": request.url.path, "status_code": status_code,
                "duration_ms": round((perf_counter() - started) * 1000, 2),
            })
        response.headers["X-Request-ID"] = request_id
        return response

    app.include_router(health_router)
    if settings.app_env == "development":
        app.include_router(search_router)
    return app


app = create_app()
