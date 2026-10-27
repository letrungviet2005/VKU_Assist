# Pilot VKU thật — tập phát triển, chưa phải số liệu báo cáo

`questions.csv` hiện có được giữ nguyên. Bộ pilot 12 câu được lưu riêng tại
`backend/data/vku-pilot/questions.json` (ignored), không ghi đè bộ 60 câu/tập giữ riêng.
`pilot.template.json` là mẫu trống để điền thủ công khi chuyển máy. Dữ liệu/gold đầy đủ
cần chuyển qua kho nội bộ của nhóm, không tự thêm vào Git chỉ vì đang ignored.

## Kho đã chuẩn bị

Đã tải trực tiếp nội dung HTML gốc của 4 bài, không lấy search snippets làm dữ liệu:

| document_id | Bài gốc | Phạm vi và hạn chế |
| --- | --- | --- |
| admissions-402-2026 | [Phương thức ĐGNL, bài ngày 10/02/2026](https://tuyensinh.vku.udn.vn/thong-bao/69af034de1fedb5e0308e872) | Có nội dung dự kiến; không coi công thức quy đổi ban đầu là hiện hành |
| admissions-entry-2026 | [Thông báo công bố điểm trúng tuyển 2026](https://tuyensinh.vku.udn.vn/thong-bao/6a79472c0619ded1f20e9b44) | Chỉ dùng các mốc nhập học trong văn bản; bảng điểm dạng ảnh không được OCR |
| academic-graduation-3-2026 | [Nhận hồ sơ xét tốt nghiệp đợt 3/2026](https://daotao.vku.udn.vn/thong-bao-dao-tao/thong-bao-nhan-ho-so-xet-tot-nghiep-dot-3-nam-2026-1358.html) | Nhóm khóa/trình độ và lịch riêng của đợt 3 |
| academic-graduation-4-2026 | [Nhận hồ sơ xét tốt nghiệp đợt 4/2026](https://daotao.vku.udn.vn/thong-bao-dao-tao/thong-bao-nhan-ho-so-xet-tot-nghiep-dot-4-nam-2026-1385.html) | Phạm vi khác đợt 3; không tự kết luận văn bản mới thay thế toàn bộ bản cũ |

Mốc công việc này là **27/10/2026**, các hạn nộp/nhập học trong kho đã qua.
Kho phục vụ kiểm chứng hồi cứu theo thông báo, không dùng làm tư vấn hạn hiện tại.
applicable_year=2026 lấy từ năm ghi trong nội dung, với học vụ là năm **đợt xét**,
không phải năm tuyển sinh của tất cả sinh viên. Phạm vi khóa nằm trong nội dung/catalog.
issued_date để null vì đây là ngày đăng HTML, chưa xác nhận ngày ban hành bản ký.
document_version là phiên bản snapshot/hash, không mạo nhận số hiệu văn bản chính thức.

Đã đọc trực tiếp [thông báo quy đổi đăng sau](https://tuyensinh.vku.udn.vn/thong-bao/6a7067db1b897aba700a1894)
để nhận diện việc bài tháng 2 chưa đủ cho công thức cuối cùng. Bài đăng sau còn có
chi tiết thời gian cần nhóm kiểm tra lại; không thêm vào chỉ mục và không tạo câu
gold về công thức quy đổi. Không khẳng định đã rà soát hết sửa đổi/thay thế.
Các file Drive đính kèm học vụ chỉ ghi URL, chưa tải/đối chiếu bản ký. Đây là điểm
Thu Trang và thành viên thứ hai phải xác minh trước khi duyệt dữ liệu.

Lần truy cập bằng công cụ web có timeout ở tuyển sinh, 502 tại trang chủ vku.udn.vn;
tải trực tiếp 4 URL bài bằng HTTP sau đó đều thành công. elib.vku.udn.vn truy cập được
trang công khai nhưng không tải tài liệu cần đăng nhập. Quy chế dạng PDF trên trang
quyche-quydinh chưa có văn bản trích xuất được từ công cụ web, không đưa vào kho này.
Không thu thập danh sách điểm/sinh viên hoặc mở các form nộp hồ sơ.

## Chuẩn bị và lập chỉ mục

**PowerShell, thư mục gốc repository**:

```powershell
& ./backend/.venv/Scripts/python.exe evaluation/prepare_vku_pilot.py
if ($LASTEXITCODE -ne 0) { throw 'Có nguồn bị chặn/chuyển đổi lỗi; kiểm tra catalog, chưa lập chỉ mục bản thiếu.' }
Set-Location backend
& ./.venv/Scripts/python.exe -m app.cli.index_documents --manifest data/vku-pilot/manifest.json --data-dir data/vku-pilot/documents --output indexes/vku-pilot
```

Script chỉ tải 4 URL cố định, không crawler và không đi theo attachment. Nó giữ raw
**main article HTML** trong `data/vku-pilot/raw/`, loại menu/sidebar/testimonial không
liên quan, ghi SHA256 response và fragment để đối chiếu, chuyển sang Markdown trong
`documents/`. Giữ tiêu đề/mục có thật, dấu Việt, mở rộng rowspan/colspan để giữ quan hệ
bảng; HTML không có số trang. Ảnh không được biến thành văn bản. Không tải file cá nhân.
Nếu layout thay đổi, script từ chối thay vì lặng lẽ nhập trang menu. Đọc lại bản chuyển
đổi và catalog sau mỗi lần tải; có thể ghi đè snapshot local nên sao lưu bản đã duyệt
trước khi cập nhật. Không tự lập lại đáp án gold sau khi thay nguồn.

Các file local (đều nằm trong thư mục đã ignore):

- `manifest.json`: đúng schema loader hiện tại, chỉ tham chiếu documents/.
- `source_catalog.json`: URL, attachment URL, ngày đăng/ngày ban hành nếu biết,
  scope, thời điểm tải, checksum, phiên bản snapshot và trạng thái chưa duyệt.
- `amendment_check.json`: ghi nhận rà soát bổ sung, không phải tài liệu đang index.
- `questions.json`: 12 câu draft do Codex soạn từ bài đã đọc, không dùng đáp án LLM.

Nếu nguồn bị chặn, catalog ghi URL/error_type. Đặt file PDF text/TXT/Markdown đã
đối chiếu vào documents/, sửa manifest theo mẫu ở [rag.md](../docs/rag.md), ghi đủ
nguồn vào catalog; không tự viết nội dung thay thế rồi gọi là tài liệu thật.

CLI hiện có đã tạo **4 tài liệu, 29 đoạn**, index_version
`3b6da6f5690e4a2caf690854fd81c92a`. Manifest SHA256:
`d1fdf3e5a2dc768795d53ad5e34ec72ab3165b671699a4fd7a62cd20adc7a09e`.
Bundle tại `backend/indexes/vku-pilot/`; pointer fixture tại `backend/indexes/active.json`
được giữ nguyên. Không thay loader/chunking/retriever để ưu tiên câu pilot.

## Bộ 12 câu và quy trình duyệt

- VKU-P01–P04: 4 câu tuyển sinh có căn cứ trong kho.
- VKU-P05–P08: 4 câu học vụ có căn cứ trong kho.
- VKU-P09–P10: cần làm rõ **đợt xét** vì thay đổi nhóm K2022 hoặc hạn nhận hồ sơ;
  không mặc định thiếu năm là phải hỏi lại.
- VKU-P11–P12: thiếu dữ liệu học phí 2027 / ngoài phạm vi.

Mỗi câu có category/year, expected_status, key_points, document_id, section/excerpt,
review_status và reviewers. Tất cả đang là draft cần **Thu Trang và một thành viên
khác** đối chiếu nguồn gốc. Không đánh dấu approved chỉ vì test chạy thành công.
Sau khi con người duyệt, điền reviewers (hai tên khác nhau, gồm `Thu Trang`), đặt
review_status=`human_approved` và từng evidence.confirmed=true. Có thể điền chunk_ids
đã đối chiếu cho đúng index_version; sau khi re-index phải duyệt mapping lại.

Nhận xét sơ bộ chưa duyệt: retrieval có thể lấy phần giới thiệu thay vì đoạn thời gian
đợt 4 ở VKU-P06/P10; đã ghi trong results, không đổi gold để làm đẹp kết quả. Câu ngoài
phạm vi vẫn có thể trả chunk gần nhất; không dùng similarity để tự chấm là đúng/từ chối.

## Chạy retrieval-only

**PowerShell, thư mục `backend`**:

```powershell
& ./.venv/Scripts/python.exe -m app.cli.evaluate --dataset data/vku-pilot/questions.json --document-manifest data/vku-pilot/manifest.json --index-dir indexes/vku-pilot --mode retrieval --limit 12 --concurrency 1 --timeout 60 --output ../evaluation/results
```

Dùng Retriever/FAISS/E5 hiện có, không gọi LLM. Dataset thực không được ghi application
log; tool lưu câu hỏi/kết quả có chủ đích trong evaluation/results (ignored).

## Bedrock preflight và tối đa 2 lời gọi smoke

Ở lượt này **Region và model/profile đều chưa được cấu hình**; thử phân giải credential
chain bằng boto3 không tìm thấy credentials. Chưa xác minh danh tính/quyền/model access
và **0 lời gọi Bedrock thật**. Không thay bằng fake để báo thành công.
Không tự chọn Region/model, sửa IAM hoặc kích hoạt Marketplace/model access.

Nhóm điền cấu hình đã xác nhận trong **PowerShell tại `backend`**:

```powershell
$env:APP_ENV = 'development'
$env:LLM_PROVIDER = 'bedrock'
$env:BEDROCK_REGION = '<REGION_DA_XAC_NHAN>'
$env:BEDROCK_MODEL_ID = '<MODEL_HOAC_INFERENCE_PROFILE_DA_XAC_NHAN>'
$env:BEDROCK_AWS_PROFILE = '<PROFILE_LOCAL_NEU_CAN>'
$env:LLM_MAX_OUTPUT_TOKENS = '512'
```

AWS CLI không bắt buộc: boto3 dùng credential chain/profile/SSO cache hoặc instance
role. Nếu dùng role/default chain, bỏ BEDROCK_AWS_PROFILE. Không đặt access key vào
file dự án. SDK tìm thấy credentials chưa chứng minh quyền/quota hoặc model access.
Xác nhận model hỗ trợ Converse/system prompt/text theo
[bảng model hiện hành](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-supported-models-features.html)
và quyền [bedrock:InvokeModel/profile](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-prereq.html).
Chỉ hoàn tất bước kích hoạt tài khoản/provider theo yêu cầu AWS bằng thao tác của nhóm.

Sau khi đã xác nhận, chạy riêng (có thể phát sinh phí), dùng câu pilot và dữ liệu thật:

```powershell
& ./.venv/Scripts/python.exe -m app.cli.evaluate --dataset data/vku-pilot/questions.json --document-manifest data/vku-pilot/manifest.json --index-dir indexes/vku-pilot --mode e2e --provider bedrock --allow-paid-calls --question-id VKU-P01 --question-id VKU-P02 --limit 2 --max-llm-calls 2 --concurrency 1 --timeout 60
```

E2E đi qua ChatService và adapter hiện có, dùng snapshot của kho thật, không chạy
HTTP vòng qua search. Không tự retry/fallback. Mặc định limit=2, concurrency=1,
max-llm-calls=2; cờ paid bắt buộc với Bedrock. Không tự chạy toàn bộ pilot trả phí.
Fake chỉ chạy nếu chỉ định `--provider fake` trong development/test; đó là kiểm tra
luồng, không chất lượng câu trả lời thật.

`--timeout` giới hạn SDK read (connect tối đa min(5, timeout)); báo thêm
timeout_exceeded cho toàn thời gian câu. `--run-timeout` (mặc định 600 giây) chặn bắt
đầu câu/lời gọi mới sau deadline. Tác vụ CPU/thread đã chạy không bị cưỡng bức hủy;
executor giữ slot đến khi kết thúc, không tạo thêm việc ngoài concurrency. Đây không
phải hard wall-clock deadline của cả tiến trình. SDK chỉ một attempt, không retry ở tool.

## Đọc kết quả và chấm thủ công

Mỗi run có thư mục riêng với:

- run.json: UTC/run_id, Git SHA/dirty, dataset/manifest/catalog hash, index_version,
  embedding model/revision, provider/model/Region, generation mode và giới hạn chạy.
- results.json: từng câu, status/answer/sources hoặc error_code, retrieval chunks có
  text/nguồn, latency, token usage nếu adapter trả về; rỗng nghĩa là chưa biết, không phải 0 token.
- automatic_summary.json: lỗi kỹ thuật, latency, tỷ lệ answered có citation hợp lệ,
  reference-hit chỉ trên gold **đã được hai người duyệt**. Khi chưa có gold duyệt,
  confirmed_reference_count=0, hit rate=null. Không có content accuracy tự suy đoán.
- manual_review.csv: người chấm điền correctness=`correct|partial|incorrect`,
  source_support=`yes|partial|no`, year_cohort_correct, clarification_or_refusal_appropriate,
  ghi chú, người duyệt và ngày duyệt. Không tự điền điểm bằng keyword/similarity.

Với retrieval-only chưa có answer thì để trống các ô chấm đáp án; chỉ đối chiếu
đoạn/nguồn. Lần chạy hiện tại: `20261027T081751Z-b754df28`, 12 câu, 0 lỗi kỹ thuật,
0 lần generate, gold xác nhận=0 nên chưa có confirmed hit rate. `inspection.json`
trong kho local lưu 3 lần đối chiếu excerpt retrieval với main HTML gốc (P01/P02/P07),
chỉ là kiểm tra sơ bộ của Codex, không thay thế duyệt của nhóm.

Draft reference overlap chỉ kiểm tra vị trí nguồn/đoạn, không chấm ngữ nghĩa đáp án.
Source_id hợp lệ không chứng minh phát biểu được nguồn hỗ trợ. Kết quả tự động,
nhận xét sơ bộ và chấm đã duyệt phải báo cáo tách riêng; 12 câu này không đại diện
chất lượng toàn hệ thống, không dùng làm test set cuối.

## Kiểm tra môi trường

Docker Engine hiện chưa kết nối được, nên chưa build/chạy lại image có dependencies
hiện tại ở mốc pilot này; không báo thành công dựa vào lần Docker trước. Khi bật Engine,
chạy kiểm tra đã mô tả trong [deployment.md](../docs/deployment.md) và mount read-only
MODEL_CACHE/indexes/vku-pilot; không đưa dữ liệu/model/index/AWS credentials vào image.
Không cài/reset Docker hoặc xóa WSL. Frontend, script AWS và kho fixture không thay đổi.
