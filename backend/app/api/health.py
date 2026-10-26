from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(tags=["health"])


@router.get("/health")
def health(request: Request) -> dict[str, str]:
    return {"status": "ok", "service": request.app.state.settings.app_name}


@router.get("/ready", responses={503: {"description": "Retrieval has not been initialized"}})
def ready(request: Request) -> JSONResponse:
    retriever = request.app.state.retriever
    if retriever is None:
        return JSONResponse(status_code=503, content={
            "status": "not_ready", "reason": request.app.state.retrieval_reason,
        })
    return JSONResponse(content={"status": "ready", "index_version": retriever.version,
                                 "scope": "retrieval"})
