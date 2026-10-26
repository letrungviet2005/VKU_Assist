# VKU_Assist

Nền tảng backend FastAPI dùng Python 3.11. Frontend hiện có được giữ nguyên.
Backend có cấu hình, log, CORS và phần truy xuất cục bộ: đọc PDF/TXT/Markdown,
chia đoạn theo tokenizer, embedding CPU và FAISS có nguồn. Chưa có chat, gọi LLM
hoặc kết nối AWS trong ứng dụng. Xem [hướng dẫn truy xuất](docs/rag.md).

Chạy nhanh trong **PowerShell, từ thư mục gốc repository**:

```powershell
py -3.11 -m venv backend/.venv
& ./backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
Set-Location backend
# Chỉ sao chép nếu chưa có .env; giữ cấu hình hiện có.
if (!(Test-Path .env)) { Copy-Item .env.example .env }
& ./.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --no-access-log
```

Mở http://127.0.0.1:8000/docs. `/health` trả 200; `/ready` trả 503 khi retrieval
chưa bật hoặc chưa nạp được model/chỉ mục. Khi nạp hợp lệ, `/ready` trả 200 cho
phần truy xuất, không xác nhận khả năng chat.

Thử ngay với **fixture minh họa, không phải tài liệu chính thức VKU**,
trong **PowerShell, thư mục `backend`**, sau khi cài dependencies ở trên:

```powershell
& ./.venv/Scripts/python.exe -m app.cli.prepare_model
& ./.venv/Scripts/python.exe -m app.cli.index_documents --manifest tests/fixtures/manifest.json --data-dir tests/fixtures/documents --output indexes
$env:APP_ENV = 'development'
$env:RETRIEVAL_ENABLED = 'true'
$env:INDEX_DIR = 'indexes'
& ./.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

Gọi `POST /api/search` bằng Swagger hoặc theo [API](docs/api.md).
Chỉ `prepare_model` tải model; CLI index và API dùng cache cục bộ.

Docker, từ **thư mục gốc repository**, cần Docker Desktop chạy Linux containers:

```powershell
docker build -t vku-assist-backend:local ./backend
docker run --rm --name vku-assist-backend -p 127.0.0.1:8000:8000 --env-file ./backend/.env vku-assist-backend:local
```

Với Docker, giá trị mảng phải không có dấu nháy bao ngoài trong `.env`:
`CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]`.
Xem [hướng dẫn triển khai](docs/deployment.md) và [API](docs/api.md) để cấu hình và kiểm tra.
