# Truy xuất cục bộ có nguồn

Phần này mô tả đọc tài liệu, chia đoạn, embedding và tìm kiếm cục bộ.
Chat một lượt với Bedrock/fake đã được bổ sung riêng ở [chat.md](chat.md).
Chưa có OCR, crawler, upload, lịch sử hay triển khai AWS. Retrieval không cần Docker/AWS.
Fixture tại `backend/tests/fixtures/` là **minh họa kiểm thử, không phải thông tin
chính thức VKU**; URL example.org chỉ là nguồn minh họa. Không dùng để tư vấn tuyển sinh.

Kho pilot VKU thật được chuẩn bị riêng ở `backend/data/vku-pilot/` và
`backend/indexes/vku-pilot/`; xem [hướng dẫn pilot](../evaluation/README.md).
Không thay pointer hoặc gold của fixture; nguồn/gold pilot chưa được con người duyệt.

## Cài đặt và chuẩn bị model

**Windows PowerShell, thư mục gốc repository**, Python 3.11 x86_64:

```powershell
# Chỉ tạo venv nếu chưa có.
if (!(Test-Path backend/.venv)) { py -3.11 -m venv backend/.venv }
& ./backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
& ./backend/.venv/Scripts/python.exe -m pip check
Set-Location backend
if (!(Test-Path .env)) { Copy-Item .env.example .env }
& ./.venv/Scripts/python.exe -m app.cli.prepare_model
```

Chỉ lệnh cuối được phép tải model từ Hugging Face; cần mạng và dung lượng trống
cho model/cache, PyTorch CPU và dependencies. Trên Windows thiếu quyền symlink,
Hub có thể lưu bản sao và dùng thêm đĩa; không cần chạy quyền quản trị.
Không tự đổi model nếu tải lỗi. Model `intfloat/multilingual-e5-small` chạy CPU,
vector 384 chiều, giới hạn 512 token. Tham khảo
[model card E5](https://huggingface.co/intfloat/multilingual-e5-small) và
[Sentence Transformers](https://sbert.net/docs/package_reference/sentence_transformer/SentenceTransformer.html).

Đã cài/kiểm chứng trên Python 3.11.9: sentence-transformers 3.4.1,
transformers 4.49.0, torch 2.6.0+cpu, faiss-cpu 1.10.0, numpy 1.26.4,
pypdf 5.4.0, huggingface-hub 0.29.3. Test API thêm httpx 0.28.1 trong requirements-dev.
Không có LangChain. CPU wheels PyTorch được chọn rõ trong requirements.

Chuẩn bị thực tế đã nạp revision `614241f622f53c4eeff9890bdc4f31cfecc418b3`.
Mặc định EMBEDDING_REVISION=main, nhưng bundle ghi commit thực từ snapshot cache.
Để tái lập cùng model, đặt EMBEDDING_REVISION thành commit đã ghi và chạy prepare_model
nếu cache chưa có. API không tự tải revision mới, không fallback model khác.

## Cấu hình

Các đường dẫn tương đối được tính từ **thư mục chạy `backend`**.
Không sửa `.env` thật bằng script; copy cấu hình mẫu nếu chưa có và tự chỉnh.

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| RETRIEVAL_ENABLED | false | Nạp retrieval khi API khởi động |
| EMBEDDING_MODEL | intfloat/multilingual-e5-small | Model phải khớp bundle |
| EMBEDDING_REVISION | main | Ref/commit cache, đối chiếu commit thực |
| MODEL_CACHE | .model-cache | Model do prepare_model chuẩn bị |
| DATA_DIR | data | Thư mục tài liệu được manifest phép tham chiếu |
| INDEX_DIR | indexes | Thư mục bundle tin cậy và active.json |
| CHUNK_SIZE | 300 | Tổng token tối đa gồm prefix và special tokens |
| CHUNK_OVERLAP | 50 | Số token nội dung chồng lấn, phải nhỏ hơn ngân sách hiệu dụng |
| SEARCH_TOP_K | 5 | Mặc định kết quả, 1–10 |

Với E5 phải giữ CHUNK_SIZE không lớn hơn giới hạn model. CLI còn kiểm tra overlap
để bảo đảm mỗi cửa sổ tiến về phía trước sau khi trừ prefix/special tokens.
Khi đổi cấu hình chunk/model, lập chỉ mục mới và khởi động lại API với cùng cấu hình.
Model chỉ nạp một lần mỗi tiến trình API, không nạp lại theo request.

## Manifest và dữ liệu đầu vào

Manifest là mảng JSON UTF-8, đường dẫn `file` tương đối với DATA_DIR:

```json
[
  {
    "file": "demo.md",
    "document_id": "demo-document",
    "title": "Tài liệu minh họa, không chính thức",
    "source_url": "https://example.org/demo/document",
    "category": "academic",
    "applicable_year": null,
    "document_version": "demo-v1"
  }
]
```

document_id phải duy nhất; category chỉ admissions/academic. source_url phải HTTP(S).
CLI từ chối đường dẫn tuyệt đối, traversal hoặc symlink dẫn ra ngoài DATA_DIR;
không chỉnh sửa tài liệu gốc. Tài liệu chính thức để riêng trong `backend/data/`,
không trộn fixture và không commit file thật. Manifest thật cũng để trong data/.

TXT/Markdown phải UTF-8 (chấp nhận BOM). Giữ dấu Việt, newline và hàng bảng;
chuẩn hóa khoảng trắng ngang vừa đủ. Markdown tách theo heading thật và giữ heading
trong nội dung; đoạn mở đầu/TXT không có mục nhận null. PDF dùng lớp văn bản,
trích xuất layout theo từng trang riêng, đánh số trang file từ 1, không theo số in
trên giấy. Không ghép trang. PDF có bất kỳ trang không trích xuất được văn bản,
PDF mã hóa, file trắng hoặc không hợp lệ đều làm CLI thất bại rõ ràng. Chưa OCR;
PDF bố cục phức tạp/bảng có thể cần người đối chiếu lại với bản gốc.

Chia cửa sổ bằng offset của tokenizer model, cắt từ chuỗi gốc để giữ Unicode,
đếm lại tiền tố `passage: ` và special tokens. Mỗi passage/query nhận đúng một
prefix tương ứng. chunk_id là SHA256 của document_id, phiên bản, content_hash,
vị trí mục/trang và khoảng token; không phụ thuộc thời điểm chạy.

## Lập chỉ mục và chạy API

**PowerShell, thư mục `backend`**, fixture minh họa:

```powershell
& ./.venv/Scripts/python.exe -m app.cli.index_documents --manifest tests/fixtures/manifest.json --data-dir tests/fixtures/documents --output indexes
if ($LASTEXITCODE -ne 0) { throw 'Index failed; active version was not replaced' }
$env:APP_ENV = 'development'
$env:RETRIEVAL_ENABLED = 'true'
$env:INDEX_DIR = 'indexes'
& ./.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

CLI có `--chunk-size` và `--overlap`; nếu dùng giá trị khác mặc định, đặt CHUNK_SIZE/
CHUNK_OVERLAP tương ứng cho API. Tài liệu thật: đổi `--manifest data/manifest.json`
và `--data-dir data`; `--output` phải trùng INDEX_DIR của API.
Không có lập chỉ mục trong search request.

**PowerShell thứ hai, thư mục bất kỳ**:

```powershell
curl.exe -i http://127.0.0.1:8000/health
curl.exe -i http://127.0.0.1:8000/ready
$Body = @{query='Tra cứu lịch học ở đâu?'; top_k=3; category='academic'} | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/search -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($Body))
```

Ctrl+C dừng API. Khi CHAT_ENABLED=false, `/ready` 200 chỉ xác nhận retrieval; thiếu index/model hoặc mismatch
thì 503, `/health` vẫn 200. Probe không tải model/gọi mạng. Search chỉ có ở
APP_ENV=development, ngoài ra 404. Khi chat được bật, readiness còn đòi hỏi cấu hình
adapter hợp lệ nhưng không gọi AWS để kiểm tra quyền/quota. Xem [API](api.md) cho schema và mã lỗi.

## Bundle và độ tin cậy

Mỗi `indexes/<index_version>/` có vectors.faiss (IndexFlatIP trên vector chuẩn hóa),
chunks.json và manifest.json. Manifest ghi model ID/commit, dimension, prefix,
giới hạn token, cấu hình chunk, số chunk, metadata tài liệu, content_hash (SHA256
file nguồn), indexed_at UTC và checksum của FAISS/chunks. active.json giữ version
và checksum manifest, chỉ được thay atomically sau khi đọc/kiểm tra lại bundle.

Kiểm tra bao gồm checksum, số vector/chunk, chiều, vector hữu hạn/chuẩn hóa,
chunk_id duy nhất và ánh xạ nguồn. Không pickle metadata. Bundle chưa hoàn tất
có thể còn trên đĩa để chẩn đoán nhưng không active. API giữ phiên bản đã nạp lúc
startup; khởi động lại sau đổi pointer. Không ghi đè bundle cũ hoặc hot reload.
Không chạy đồng thời nhiều CLI vào cùng output (chưa có điều phối nhiều writer).

Checksum phát hiện lỗi dữ liệu, không xác thực nhà phát hành. Chỉ đọc bundle
do CLI tạo trong thư mục cục bộ tin cậy; không nhận FAISS từ người dùng bên ngoài.
Nếu đổi DATA_DIR/MODEL_CACHE/INDEX_DIR, tự bảo đảm đường dẫn đó không được Git track
hoặc đưa vào Docker context. Mặc định data/indexes/.model-cache đã được loại trừ;
image không nhúng model/index. Docker retrieval mặc định tắt; chưa thiết kế mount
và triển khai retrieval trên AWS trong bước này.

Lọc metadata bên trong FAISS bằng IDSelector trước khi chốt top_k, không tạo lại
chỉ mục và không embedding lại tài liệu trong request.
Không có kết quả phù hợp thì trả rỗng. Score không phải xác suất; vài câu thử không
đo được accuracy và chưa có ngưỡng đánh giá câu hỏi ngoài phạm vi. Exact FAISS và
việc quét chính xác phù hợp kho nhỏ, chưa tối ưu cho kho lớn hoặc tải cao.

## Kiểm thử

**PowerShell, thư mục `backend`**:

```powershell
& ./.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
& ./.venv/Scripts/python.exe -m unittest discover -s tests -p test_retrieval.py
& ./.venv/Scripts/python.exe tests/smoke.py
# Chỉ chạy sau prepare_model + lập chỉ mục fixture vào indexes như trên.
& ./.venv/Scripts/python.exe tests/real_smoke.py
& ./.venv/Scripts/python.exe -m pip check
```

Logic tests dùng embedding/tokenizer giả, nhưng chạy FAISS thật và tạo PDF thật:
Unicode, mục/trang, giới hạn token, lọc trước top_k, roundtrip, checksum/file thiếu,
mismatch, lỗi lập chỉ mục giữ bản active, readiness/search validation và route production.
real_smoke chạy model CPU thật, khởi động Uvicorn offline trên cổng riêng, gọi HTTP
tiếng Việt, kiểm tra nguồn minh họa và dừng tiến trình sau kiểm tra. Không kết luận
tỷ lệ chính xác từ hai câu hỏi. Trên máy này fixture tạo 2 tài liệu/4 đoạn;
câu lịch học trả đúng mục `Tra cứu lịch học`, câu hồ sơ trả đúng nguồn admissions.

Docker Linux/amd64 cũng đã build và chạy thực tế: `/health` 200, `/ready` 503
khi retrieval tắt, `/docs` và `/openapi.json` 200, X-Request-ID có mặt,
HEALTHCHECK healthy, UID 10001, import dependencies CPU và pip check đạt.
Kiểm tra filesystem `/app` và `/home/appuser` không thấy `.env`, AWS credentials,
venv, tài liệu, index hoặc model cache/weights; container thử đã được xóa.
Retrieval trong Docker cũng đã chạy thật với network=none và model/index mount
read-only từ host: `/ready` 200, truy vấn tiếng Việt trả đúng mục và nguồn;
container tạm đã xóa. Chưa kiểm chứng trên tài liệu VKU thật hoặc đo chất lượng
truy xuất ở quy mô thực tế. Không thực hiện AWS trong bước này.
