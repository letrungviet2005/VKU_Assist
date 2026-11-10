from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class AdminLoginRequest(BaseModel):
    """Schema for administrator authentication request."""
    model_config = ConfigDict(extra="forbid")

    username: str = Field(..., min_length=1, max_length=100, description="Tên đăng nhập quản trị viên")
    password: str = Field(..., min_length=1, max_length=100, description="Mật khẩu quản trị")


class AdminTokenResponse(BaseModel):
    """Schema for successful administrator login token."""
    model_config = ConfigDict(extra="forbid")

    access_token: str = Field(..., description="Mã JWT Bearer token")
    token_type: str = Field(default="bearer", description="Loại token")
    expires_at: int = Field(..., description="Thời điểm hết hạn (Unix timestamp milliseconds)")


class DocumentItem(BaseModel):
    """Schema for a document stored in the VKU Assist knowledge base."""
    model_config = ConfigDict(extra="ignore")

    document_id: str = Field(..., description="Mã định danh duy nhất của tài liệu")
    title: str = Field(..., description="Tiêu đề tài liệu chính thức")
    category: str = Field(default="academic", description="Danh mục (academic, admissions)")
    source_url: str | None = Field(default=None, description="Đường dẫn nguồn tài liệu")
    applicable_year: int | None = Field(default=None, description="Năm học áp dụng")
    issue_date: str | None = Field(default=None, description="Ngày ban hành")
    version: str = Field(default="v1.0", description="Phiên bản tài liệu")
    status: Literal["ready", "processing", "failed", "pending"] = Field(default="ready", description="Trạng thái chỉ mục")
    chunks_count: int = Field(default=0, description="Số lượng đoạn vector chunk trích xuất")
    size_mb: float = Field(default=0.0, description="Dung lượng tệp (MB)")
    updated_at: str = Field(..., description="Thời điểm cập nhật gần nhất")


class DocumentUploadRequest(BaseModel):
    """Schema for document metadata submission (JSON payload)."""
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=300, description="Tiêu đề tài liệu chính thức")
    category: Literal["academic", "admissions"] = Field(default="academic", description="Danh mục (academic hoặc admissions)")
    source_url: str | None = Field(default=None, description="Đường dẫn tham chiếu")
    applicable_year: int | None = Field(default=None, ge=1900, le=2200, description="Năm áp dụng")
    issue_date: str | None = Field(default=None, description="Ngày ban hành (YYYY-MM-DD)")


class DocumentUploadResponse(BaseModel):
    """Schema for accepted document upload response."""
    model_config = ConfigDict(extra="forbid")

    document_id: str = Field(..., description="Mã tài liệu vừa khởi tạo")
    job_id: str = Field(..., description="Mã tác vụ chỉ mục nền")
    status: str = Field(default="accepted", description="Trạng thái tiếp nhận")


class JobStatusResponse(BaseModel):
    """Schema for background indexing job status."""
    model_config = ConfigDict(extra="ignore")

    job_id: str = Field(..., description="Mã tác vụ nền")
    document_id: str = Field(..., description="Mã tài liệu liên kết")
    status: Literal["processing", "completed", "failed"] = Field(..., description="Trạng thái tác vụ")
    progress: int = Field(default=0, ge=0, le=100, description="Tiến độ hoàn thành (0-100%)")
    title: str = Field(..., description="Tiêu đề tài liệu đang xử lý")
    index_version: str | None = Field(default=None, description="Phiên bản chỉ mục sau khi xuất bản")
    error_message: str | None = Field(default=None, description="Thông báo lỗi nếu tác vụ thất bại")
    created_at: str = Field(..., description="Thời điểm tạo tác vụ")
    updated_at: str = Field(..., description="Thời điểm cập nhật trạng thái gần nhất")


class DocumentDeleteResponse(BaseModel):
    """Schema for document removal response."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(default="deleted", description="Trạng thái xóa")
    document_id: str = Field(..., description="Mã tài liệu đã xóa")
