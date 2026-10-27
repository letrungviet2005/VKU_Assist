# API nền tảng

Base URL cục bộ: `http://127.0.0.1:8000`.

| Endpoint | HTTP | Phản hồi |
| --- | --- | --- |
| `GET /health` | 200 | `{"status":"ok","service":"VKU Assist"}`; service lấy từ APP_NAME |
| `GET /ready` | 200/503 | Trạng thái truy xuất và index_version, hoặc reason chưa sẵn sàng |
| `GET /docs` | 200 | Swagger UI |
| `GET /openapi.json` | 200 | OpenAPI schema |

`/health` kiểm tra tiến trình backend, không gọi AWS, LLM hoặc tải model.
Khi CHAT_ENABLED=false, `/ready` xác nhận **phần truy xuất**.
Khi retrieval chưa bật, trả 503 `retrieval_not_initialized`; khi không có bundle,
trả `retrieval_index_missing`; model cache không nạp được trả
`retrieval_model_unavailable`; checksum/cấu hình/bundle không hợp lệ trả
`retrieval_load_failed`. Khi tất cả đã nạp hợp lệ, trả
`{"status":"ready","scope":"retrieval","index_version":"..."}` với HTTP 200.
Cả hai endpoint probe không tải model, không embedding và không gọi mạng.
Lỗi khởi tạo retrieval không làm `/health` ngừng hoạt động.
Docker HEALTHCHECK tiếp tục dùng `/health`.

Khi CHAT_ENABLED=true, `/ready` còn yêu cầu adapter được cấu hình hợp lệ: trả 503
`chat_not_configured` nếu thiếu/sai Region/model; `fake_not_allowed` nếu production
chọn fake. Hợp lệ trả 200 với scope `retrieval_and_chat_configuration` và index_version.
Đây chỉ là kiểm tra cấu hình cục bộ, không bảo đảm credentials/quyền/model access/quota
hoặc khả năng tuân thủ prompt của Bedrock. Không gọi Bedrock/STS từ probe hoặc startup.

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

HTTP 503 dùng error envelope bên dưới, code là reason tương ứng `/ready`.
HTTP 422 cho dữ liệu đầu vào không hợp lệ. Error envelope thống nhất đã thay thế
`detail` trước đây cho `/api/search`, các lỗi HTTP và validation.

Trong **PowerShell thứ hai, thư mục bất kỳ**, sau khi chạy API development:

```powershell
$Body = @{ query = 'Tra cứu lịch học ở đâu?'; top_k = 3; category = 'academic' } | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/search -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($Body))
```

## POST /api/chat (một lượt)

Route có trong mọi môi trường nhưng mặc định CHAT_ENABLED=false nên trả 503
`chat_disabled`. Chưa có xác thực; chỉ chạy cục bộ hoặc trong mạng kiểm thử được giới hạn.
Không mở API chat ra Internet trước khi có auth và giới hạn dùng chung phù hợp.
Đây là hợp đồng chat một lượt tạm thời; `session_id`, `history` và mọi trường ngoài
schema bị từ chối 422, không âm thầm bỏ qua. Chưa có upload/index công khai.

```json
{"message":"Tra cứu lịch học ở đâu?","category":"academic","applicable_year":2026}
```

`message`: trim, không rỗng, tối đa CHAT_MAX_MESSAGE_CHARS (mặc định 2000, trần 2000)
và giới hạn token embedding. Bộ lọc như search; `applicable_year` là integer,
không chấp nhận chuỗi số. Không truyền top_k; chat dùng SEARCH_TOP_K đã cấu hình.

HTTP 200 ví dụ **FAKE, nguồn minh họa**:

```json
{
  "message_id":"<UUID>",
  "request_id":"<UUID khớp X-Request-ID>",
  "status":"answered",
  "answer":"FAKE — KIỂM THỬ: Phản hồi kiểm tra luồng dẫn nguồn [S1].",
  "sources":[{
    "source_id":"S1",
    "chunk_id":"<chunk hash>",
    "document_id":"demo-academic",
    "title":"Minh họa tra cứu học tập (không chính thức)",
    "url":"https://example.org/demo/academic",
    "page_or_section":"Tra cứu lịch học",
    "applicable_year":null,
    "document_version":"demo-v1"
  }],
  "index_version":"<index version>",
  "generation_mode":"fake"
}
```

status nhận `answered`, `needs_clarification`, `insufficient_evidence`.
generation_mode nhận `bedrock`/`fake`; với trường hợp không gọi LLM do không có
ngữ cảnh, đây vẫn là provider đã cấu hình, không phải bằng chứng đã gọi provider.
Source IDs S1… chỉ có ý nghĩa trong request; chunk_id/index_version dùng đối chiếu
bundle. sources chỉ gồm nguồn được trích trong answer và thực sự gửi model.
Tên, URL, trang và phiên bản luôn lấy từ backend, không lấy từ model.
Không có đoạn phù hợp sau lọc/ngân sách ngữ cảnh thì insufficient_evidence,
sources=[], không gọi LLM. Không có ngưỡng similarity để tự kết luận ngoài phạm vi.

**PowerShell, thư mục bất kỳ**, sau khi chạy backend theo [chat.md](chat.md):

```powershell
$Body = @{ message='Tra cứu lịch học ở đâu?'; category='academic' } | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/chat -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($Body))
```

Trong Swagger `/docs`, chọn POST /api/chat → Try it out; không truyền session/history.

## Lỗi API

```json
{"error":{"code":"chat_disabled","message":"Chat chưa được bật hoặc cấu hình hợp lệ.","request_id":"<UUID>"}}
```

| HTTP | Code điển hình | Ý nghĩa |
| --- | --- | --- |
| 422 | invalid_request, message_too_long, message_exceeds_embedding_limit | Đầu vào sai hoặc quá dài |
| 429 | chat_concurrency_exceeded | Hết slot trong tiến trình ứng dụng |
| 503 | chat_disabled, chat_not_configured, fake_not_allowed | Chat chưa cấu hình hợp lệ |
| 503 | retrieval_not_initialized, retrieval_index_missing, retrieval_model_unavailable, retrieval_load_failed | Retrieval chưa sẵn sàng |
| 503 | bedrock_quota_exceeded | Throttling/quota Bedrock, khác với 429 của ứng dụng |
| 503 | bedrock_credentials_unavailable, bedrock_access_denied | Chưa có credentials/quyền phù hợp |
| 503 | bedrock_configuration_error, bedrock_unavailable | Model/request không phù hợp hoặc dịch vụ tạm lỗi |
| 504 | bedrock_timeout | Timeout kết nối/đọc hoặc model timeout |
| 502 | invalid_llm_response | JSON/schema/citation, stop reason hoặc nội dung upstream không hợp lệ |

Không trả nguyên output lỗi từ model hoặc lỗi SDK. Validation không echo nội dung
đầu vào. `/health` và `/ready` giữ schema probe riêng như mô tả phía trên.
