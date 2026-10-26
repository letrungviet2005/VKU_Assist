# API nền tảng

Base URL cục bộ: `http://127.0.0.1:8000`.

| Endpoint | HTTP | Phản hồi |
| --- | --- | --- |
| `GET /health` | 200 | `{"status":"ok","service":"VKU Assist"}`; service lấy từ APP_NAME |
| `GET /ready` | 200/503 | Trạng thái truy xuất và index_version, hoặc reason chưa sẵn sàng |
| `GET /docs` | 200 | Swagger UI |
| `GET /openapi.json` | 200 | OpenAPI schema |

`/health` kiểm tra tiến trình backend, không gọi AWS, LLM hoặc tải model.
`/ready` hiện xác nhận **phần truy xuất**, chưa xác nhận khả năng chat/LLM.
Khi retrieval chưa bật, trả 503 `retrieval_not_initialized`; khi không có bundle,
trả `retrieval_index_missing`; model cache không nạp được trả
`retrieval_model_unavailable`; checksum/cấu hình/bundle không hợp lệ trả
`retrieval_load_failed`. Khi tất cả đã nạp hợp lệ, trả
`{"status":"ready","scope":"retrieval","index_version":"..."}` với HTTP 200.
Cả hai endpoint probe không tải model, không embedding và không gọi mạng.
Lỗi khởi tạo retrieval không làm `/health` ngừng hoạt động.
Docker HEALTHCHECK tiếp tục dùng `/health`.

Mỗi request được cấp UUID mới, trả qua `X-Request-ID`. Log JSON gồm request_id,
method, path (không có query string), status_code và duration_ms. Không ghi body,
token, mật khẩu hay các header request. Dùng `--no-access-log` khi chạy Uvicorn
để tránh access log mặc định ghi query string.

CORS mặc định cho phép `http://localhost:5173` và `http://127.0.0.1:5173`.
Trình duyệt có thể đọc `X-Request-ID`. Origin ngoài danh sách không có
`Access-Control-Allow-Origin`; preflight bị từ chối với 400. CORS không phải cơ chế
xác thực: request GET trực tiếp vẫn có thể trả 200.

Kiểm tra từ **PowerShell, thư mục bất kỳ**, sau khi server chạy:

```powershell
curl.exe -i http://127.0.0.1:8000/health
curl.exe -i http://127.0.0.1:8000/ready
curl.exe -i http://127.0.0.1:8000/openapi.json
curl.exe -i -H 'Origin: http://localhost:5173' http://127.0.0.1:8000/health
curl.exe -i -H 'Origin: https://outside.example' http://127.0.0.1:8000/health
curl.exe -i -X OPTIONS -H 'Origin: https://outside.example' -H 'Access-Control-Request-Method: GET' http://127.0.0.1:8000/health
```

## POST /api/search (chỉ development)

Route chỉ được đăng ký khi `APP_ENV=development`; ngoài development trả 404.
Đây là API phát triển cục bộ, chưa có đăng nhập, không mở công khai.
Retrieval cần được bật và chuẩn bị theo [rag.md](rag.md). Không có API upload/index.

Body JSON:

```json
{"query":"Tra cứu lịch học ở đâu?","top_k":5,"category":"academic"}
```

`query` được trim, không rỗng, tối đa 2000 ký tự; còn phải nằm trong giới hạn
token model, tính cả `query: ` và special tokens (quá giới hạn trả 422).
`top_k` nhận 1–10, bỏ qua/null dùng SEARCH_TOP_K (mặc định 5).
`category` tùy chọn `academic`/`admissions`; `applicable_year` tùy chọn số nguyên
1900–2200, bỏ qua/null nghĩa là không lọc năm. Không khớp bộ lọc trả results rỗng.

HTTP 200 trả `query`, `index_version`, `request_id` (khớp header X-Request-ID),
`results`. Mỗi kết quả có `chunk_id`, `document_id`, `text`, `score`, `title`,
`source_url`, `page_or_section`, `category`, `applicable_year`, `document_version`,
`content_hash`, `indexed_at`.
PDF dùng số trang trong file từ 1; Markdown dùng heading thật; TXT không có mục
thì `page_or_section=null`. Score là inner product trên vector chuẩn hóa,
**không phải phần trăm độ chắc chắn** và không có ngưỡng kết luận ngoài phạm vi.

HTTP 503: `{"detail":{"code":"retrieval_not_initialized"}}` hoặc các mã reason
như `/ready`. HTTP 422 cho dữ liệu đầu vào không hợp lệ.

Trong **PowerShell thứ hai, thư mục bất kỳ**, sau khi chạy API development:

```powershell
$Body = @{ query = 'Tra cứu lịch học ở đâu?'; top_k = 3; category = 'academic' } | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/search -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($Body))
```
