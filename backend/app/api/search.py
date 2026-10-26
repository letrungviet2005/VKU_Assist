from fastapi import APIRouter, HTTPException, Request

from app.rag.schemas import SearchInput

router = APIRouter(tags=["retrieval"])


@router.post("/api/search")
def search(body: SearchInput, request: Request):
    retriever = request.app.state.retriever
    if retriever is None:
        raise HTTPException(status_code=503, detail={"code": request.app.state.retrieval_reason})
    try:
        results = retriever.search(body.query, body.top_k or request.app.state.settings.search_top_k,
                                   body.category, body.applicable_year)
    except ValueError:
        raise HTTPException(status_code=422, detail={"code": "query_exceeds_model_token_limit"}) from None
    return {"query": body.query, "index_version": retriever.version,
            "request_id": request.state.request_id, "results": results}
