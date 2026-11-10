from fastapi import APIRouter, Request

from app.core.config import get_settings
from app.core.errors import ServiceError
from app.core.security import create_access_token, verify_admin_credentials
from app.schemas.document import AdminLoginRequest, AdminTokenResponse

router = APIRouter(prefix="/api/admin", tags=["admin-auth"])


@router.post("/login", response_model=AdminTokenResponse)
async def admin_login(request: Request, payload: AdminLoginRequest):
    """Authenticate administrator and issue JWT Bearer access token."""
    settings = getattr(request.app.state, "settings", get_settings())

    if not verify_admin_credentials(payload.username, payload.password, settings):
        raise ServiceError(
            401,
            "invalid_credentials",
            "Tài khoản hoặc mật khẩu quản trị không chính xác.",
        )

    token, expires_at = create_access_token(
        {"sub": payload.username, "role": "admin"}, settings
    )

    return AdminTokenResponse(
        access_token=token,
        token_type="bearer",
        expires_at=expires_at,
    )
