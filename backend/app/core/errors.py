from fastapi import Request
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str | None


class ErrorEnvelope(BaseModel):
    error: ErrorDetail


class ServiceError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message


def error_response(request: Request, status: int, code: str, message: str):
    request.state.error_code = code
    return JSONResponse(status_code=status, content={"error": {
        "code": code, "message": message,
        "request_id": getattr(request.state, "request_id", None),
    }})


async def service_error_handler(request: Request, error: ServiceError):
    return error_response(request, error.status, error.code, error.message)


async def validation_error_handler(request: Request, error: RequestValidationError):
    # Do not echo invalid input, which may contain user text or secrets.
    return error_response(request, 422, "invalid_request", "Dữ liệu yêu cầu không hợp lệ.")


async def http_error_handler(request: Request, error: HTTPException):
    code = error.detail.get("code", "http_error") if isinstance(error.detail, dict) else "http_error"
    return error_response(request, error.status_code, code, "Không thể xử lý yêu cầu.")
