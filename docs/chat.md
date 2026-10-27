# Chat một lượt có dẫn nguồn

Backend dùng trực tiếp snapshot Retriever, không gọi HTTP /api/search. Chưa có
session/history/câu hỏi tiếp nối, DynamoDB, auth, feedback, upload, streaming,
tool calling hoặc agent. Không có kho phiên trong RAM. Frontend và script AWS giữ nguyên.
Dữ liệu demo mặc định là **2 tài liệu/4 đoạn fixture minh họa**. Kho pilot VKU thật
4 tài liệu được tách riêng, xem [evaluation/README.md](../evaluation/README.md).
Chưa có đánh giá đáp án Bedrock thật trên kho pilot.

## Chạy fake cục bộ

**Windows PowerShell, thư mục gốc repository**:

```powershell
& ./backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
Set-Location backend
# Chỉ cần hai lệnh chuẩn bị sau nếu chưa có model và chỉ mục fixture.
& ./.venv/Scripts/python.exe -m app.cli.prepare_model
& ./.venv/Scripts/python.exe -m app.cli.index_documents --manifest tests/fixtures/manifest.json --data-dir tests/fixtures/documents --output indexes
$env:APP_ENV = 'development'
$env:RETRIEVAL_ENABLED = 'true'
$env:INDEX_DIR = 'indexes'
$env:CHAT_ENABLED = 'true'
$env:LLM_PROVIDER = 'fake'
& ./.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

Fake chỉ được chọn rõ trong development/test, bị chặn trong production và không
tự bật khi Bedrock lỗi/thiếu credentials. Fake không phân tích câu hỏi; luôn ghi
`FAKE — KIỂM THỬ` và generation_mode=fake. Đây là kiểm tra luồng, không phải đo
chất lượng câu trả lời. `/docs` có POST /api/chat; ví dụ request/response ở [API](api.md).
Dừng bằng Ctrl+C. Các biến `$env:` chỉ áp dụng cho PowerShell hiện tại; mở cửa sổ
mới hoặc đặt CHAT_ENABLED=false để quay lại chế độ retrieval thuần.

Trong **PowerShell thứ hai, thư mục bất kỳ**:

```powershell
curl.exe -i http://127.0.0.1:8000/health
curl.exe -i http://127.0.0.1:8000/ready
$Body = @{message='Tra cứu lịch học ở đâu?'; category='academic'} | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/chat -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($Body))
```

## Cấu hình

Ứng dụng đọc `.env` ở thư mục `backend`; environment được ưu tiên. Không tự sửa `.env`
đang có. `.env.example` chỉ chứa mẫu, không có access key/secret key/token.

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| CHAT_ENABLED | false | Bật chat rõ ràng |
| LLM_PROVIDER | bedrock | bedrock hoặc fake |
| BEDROCK_REGION | rỗng | Region đã được nhóm kiểm chứng |
| BEDROCK_MODEL_ID | rỗng | Model ID/ARN hoặc inference profile ID/ARN đã được cấp quyền |
| BEDROCK_AWS_PROFILE | rỗng | Profile local tùy chọn, để rỗng trên EC2 |
| LLM_CONNECT_TIMEOUT | 5 | Giây chờ kết nối, >0 đến 60 |
| LLM_READ_TIMEOUT | 60 | Giây chờ đọc, >0 đến 300 |
| LLM_MAX_OUTPUT_TOKENS | 1024 | Giới hạn output, 64–8192; phải phù hợp model |
| CHAT_MAX_MESSAGE_CHARS | 2000 | Giới hạn ký tự input, tối đa 2000; còn giới hạn token E5 |
| CHAT_MAX_CONTEXT_CHARS | 12000 | Ngân sách JSON nội dung tài liệu + metadata, 1–100000 |
| CHAT_MAX_CONCURRENCY | 2 | Slot mỗi tiến trình, 1–32 |

Chat dùng SEARCH_TOP_K và cấu hình retrieval hiện có. Context budget tính ký tự
Unicode của documents JSON, **không phải tokenizer của LLM**; chưa tự biết context
window của từng model. Nhóm phải chọn ngân sách/output phù hợp model. Câu hỏi và
system prompt có giới hạn riêng và không nằm trong budget documents. Chỉ lấy cả
chunk vừa budget, không cắt ngang rồi gán nguồn cho phần chưa gửi.

## Amazon Bedrock

Nhóm chọn Region và model/profile có quyền truy cập trong tài khoản; không có model
hoặc Region mặc định được suy đoán. Adapter dùng boto3 1.37.38, bedrock-runtime
Converse (text), system prompt và maxTokens. Không dùng tools, streaming hay tính năng
native structured output phụ thuộc model. Model được chọn phải hỗ trợ Converse,
system message và sinh JSON text theo hướng dẫn; phản hồi không phù hợp bị từ chối
có kiểm soát, không tự chuyển model/provider. Không dùng ARN Prompt management
vì hợp đồng này tự gửi system/inferenceConfig.
Tham khảo [Converse SDK](https://docs.aws.amazon.com/boto3/latest/reference/services/bedrock-runtime/client/converse.html)
và [Converse API](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html).

Converse cần quyền **bedrock:InvokeModel** cho resource đúng model/profile. Không
cần InvokeModelWithResponseStream cho luồng này. Với inference profile, cần quyền
trên profile và các foundation model liên quan; cross-Region còn phụ thuộc quyền
và SCP tại các Region đích. Không cấp AmazonBedrockFullAccess chỉ để chạy ứng dụng.
Nhóm xác nhận model access/điều kiện provider và quota trong tài khoản. Xem
[quyền inference](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-prereq.html)
và [quyền inference profile](https://docs.aws.amazon.com/bedrock/latest/userguide/geographic-cross-region-inference.html).

AWS SDK dùng credential chain mặc định, không lưu khóa trong cấu hình ứng dụng.
Local có thể dùng profile/SSO đã cấu hình bằng AWS CLI; EC2 dùng instance role,
để BEDROCK_AWS_PROFILE rỗng và không đặt biến static credentials. Không có lệnh tạo
tài nguyên AWS trong bước này; không mount AWS credentials vào image hoặc commit chúng.

**PowerShell, thư mục `backend`**, sau khi chuẩn bị retrieval và đăng nhập profile:

```powershell
$env:APP_ENV = 'development'
$env:RETRIEVAL_ENABLED = 'true'
$env:CHAT_ENABLED = 'true'
$env:LLM_PROVIDER = 'bedrock'
$env:BEDROCK_REGION = '<REGION_DA_XAC_NHAN>'
$env:BEDROCK_MODEL_ID = '<MODEL_ID_HOAC_INFERENCE_PROFILE>'
$env:BEDROCK_AWS_PROFILE = '<PROFILE_LOCAL>'
# Nếu dùng credential chain mặc định/instance role: bỏ BEDROCK_AWS_PROFILE.
& ./.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

SDK client chỉ được tạo ở lần generate đầu tiên rồi dùng lại. Import/startup/probes
không tạo client, không gọi Bedrock hay STS. `/ready` chỉ xác nhận retrieval và cấu
hình adapter, không chứng minh credentials/quota/quyền hoặc chất lượng đáp án.
Lỗi Bedrock tạm thời không làm liveness thất bại.

## Luồng, nguồn và giới hạn

Mỗi request giữ một tham chiếu snapshot và trả index_version tương ứng. Sau lọc
metadata, các chunk vừa budget được gán S1… và đóng gói cùng câu hỏi bằng JSON
trong user message; system prompt tách riêng ở `app/rag/prompts.py`. Nội dung tài
liệu/câu hỏi là dữ liệu không tin cậy, không được coi là system instructions.
Prompt yêu cầu tiếng Việt, không tự bổ sung thông tin VKU ngoài nguồn, hỏi làm rõ
năm/phạm vi khi cần, trình bày mâu thuẫn thay vì tự ưu tiên năm mới hơn.

Model phải trả JSON đúng status/answer/cited_source_ids. Backend từ chối JSON lỗi,
duplicate keys, schema/status sai, output bị cắt/refused, mã lạ, danh sách không
khớp `[S1]` trong answer và answered không có nguồn. Không chấp nhận URL/link tự
tạo trong answer; URL/title/page của sources luôn lấy từ metadata của chunk đã gửi.
Nguồn trả về có chunk_id để đối chiếu bundle. Không trả raw output lỗi và không
retry LLM để sửa JSON. Không có ngưỡng similarity suy đoán ngoài phạm vi.

Kiểm tra citation **chỉ xác nhận nguồn có trong ngữ cảnh, chưa chứng minh từng
phát biểu được nguồn hỗ trợ**. Chưa đánh giá tính đúng, mâu thuẫn, năm áp dụng hay
prompt injection trên model Bedrock thật/tài liệu VKU thật. Fake injection tests
chỉ xác nhận đóng gói prompt và validation, không chứng minh model chống injection.

Embedding và boto3 chạy trong worker thread của route đồng bộ, không chặn event loop.
Semaphore lấy không chờ, trả 429 khi hết slot; chỉ trả slot khi công việc sync thực
sự kết thúc. Không bọc thread bằng async timeout rồi trả slot sớm. SDK có connect/read
timeout và total_max_attempts=1 (không retry), không có tầng application retry.
Timeout mạng không phải cơ chế hủy chắc chắn inference đã bắt đầu ở AWS.
Giới hạn slot là **trong một tiến trình**, không dùng chung cho nhiều worker/EC2;
chưa có hàng đợi hay rate limiter phân tán và không có kho phiên RAM.

Log JSON chỉ ghi IDs, index_version, provider/model, thời gian retrieval/generation,
số chunk, token usage nếu có, outcome/error_code. Không log nội dung câu hỏi,
tài liệu, prompt, answer hoặc credentials. SDK log giữ WARNING trở lên; không bật
boto3/botocore DEBUG. Không ước tính tiền từ token usage trong bước này.

## Kiểm thử và smoke có chủ đích

**PowerShell, thư mục `backend`**:

```powershell
& ./.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
& ./.venv/Scripts/python.exe -m unittest discover -s tests -p 'test_*.py'
& ./.venv/Scripts/python.exe tests/smoke.py
# E5 thật + index fixture đã chuẩn bị, generation FAKE, không gọi AWS:
& ./.venv/Scripts/python.exe tests/chat_smoke.py --provider fake
& ./.venv/Scripts/python.exe -m pip check
```

Unit tests dùng fake và botocore Stubber/dummy test credentials, không gọi dịch vụ
trả phí. HTTP smoke tạo cổng riêng, nạp E5/index local rồi dừng tiến trình.
Bedrock thật **chưa được kiểm chứng**, chưa chọn model/Region cho tài khoản này.

Chỉ sau khi nhóm cấu hình và xác nhận quyền/quota/ngân sách, chạy riêng lệnh sau
tại **PowerShell, thư mục `backend`** để cho phép tối đa **một** yêu cầu generate thật
(có thể phát sinh phí), không nằm trong test suite:

```powershell
& ./.venv/Scripts/python.exe tests/chat_smoke.py --provider bedrock --allow-paid-call
```

Dùng biến BEDROCK_* đã điền phía trên; dữ liệu là câu hỏi lịch học trên fixture,
không có tài liệu thật/bí mật. Script in provider/model/Region, status, IDs và số nguồn,
không in prompt/answer. Nhóm ghi kết quả, không gọi lại liên tục nếu bị 502/503.
Test contract đạt không đồng nghĩa đáp án thực tế chính xác.

Dependencies đã cài trong backend/.venv và pip check đạt. Lượt chat này Docker Engine
không kết nối được (pipe Docker Desktop Linux Engine không tồn tại), nên image có
boto3 mới chưa được build/chạy lại. Dockerfile không đổi; khi Engine hoạt động:

```powershell
# PowerShell tại thư mục gốc repository
docker build --platform linux/amd64 -t vku-assist-backend:chat-check ./backend
```

Chưa triển khai AWS. Bước tiếp theo về dữ liệu cần tài liệu VKU thật có nguồn/phiên
bản/năm áp dụng và bộ câu hỏi đánh giá; phiên hội thoại cần thiết kế lưu trữ/dữ liệu
người dùng dùng chung phù hợp nhiều EC2 ở một bước riêng.
