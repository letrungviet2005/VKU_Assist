# BẢN PHÂN CÔNG NHIỆM VỤ & MA TRẬN TRÁCH NHIỆM DỰ ÁN VKU ASSIST
**Hệ thống Trợ lý ảo Học vụ & Tuyển sinh Thông minh VKU**  
**Phiên bản:** v2.0  
**Ngày cập nhật:** Tháng 11/2026  

---

## 1. MỤC TIÊU & PHẠM VI DỰ ÁN

Dự án **VKU Assist** xây dựng trợ lý AI chuyên biệt cho Trường Đại học Công nghệ Thông tin và Truyền thông Việt - Hàn (VKU), giúp sinh viên và thí sinh tra cứu chính xác quy chế đào tạo, học phí, học bổng và đề án tuyển sinh dựa trên công nghệ Retrieval-Augmented Generation (RAG) và Amazon Bedrock.

---

## 2. MA TRẬN PHÂN CÔNG NHIỆM VỤ THEO HỢP PHẦN

| STT | Phân hệ / Hợp phần | Thành viên phụ trách | Nhiệm vụ chi tiết | Trạng thái |
| :---: | :--- | :--- | :--- | :---: |
| **1** | **Frontend & API Contract Integration** | **Thanh Vương** | - Thiết kế giao diện Tra cứu & Hỏi đáp học vụ (React/Vite).<br>- Tích hợp bộ chuyển mạch 2 chiều: Dữ liệu mẫu (VKU Mock) và Backend thật (Port 8000).<br>- Chuẩn hóa giao tiếp API Contract, xử lý Error Envelope.<br>- Phát triển Thẻ nguồn dẫn chứng RAG (`SourceCard`) và Màn hình Quản trị kho tài liệu.<br>- Thiết kế hệ thống Design System nhận diện VKU, Dark/Light Mode. | **Hoàn thành 100%** |
| **2** | **RAG Core & Retrieval Pipeline** | **Lê Trung Việt & Nhóm RAG** | - Xây dựng pipeline bóc tách PDF, Markdown, TXT.<br>- Triển khai Tokenizer-aware chunking với mô hình `multilingual-e5-small`.<br>- Lập chỉ mục FAISS `IndexFlatIP` trên CPU kết hợp chuẩn hóa L2.<br>- Cơ chế quản lý bundle bất biến và con trỏ nguyên tử `active.json`.<br>- Tối ưu bộ lọc metadata với `faiss.IDSelectorBatch`. | **Hoàn thành 100%** |
| **3** | **LLM Service & Grounding Engine** | **Nhóm Backend** | - Tích hợp Amazon Bedrock Converse API và Fake LLM Adapter.<br>- Xây dựng System Prompt định hướng trích dẫn `[S1]`, `[S2]`.<br>- Triển khai Pydantic Schema `ModelAnswer` và `ChatOutput`.<br>- Xây dựng Hàng rào chống ảo giác (Anti-hallucination guardrails).<br>- Điều phối tài nguyên qua `BoundedSemaphore`. | **Hoàn thành 100%** |
| **4** | **Hạ tầng & Triển khai (DevOps/Infra)** | **Nhóm Infra** | - Đóng gói Docker container cho Backend FastAPI.<br>- Cấu hình Dockerfile tối ưu CPU wheel PyTorch và FAISS.<br>- Viết kịch bản khởi tạo EC2, Nginx Reverse Proxy và script deploy ECR.<br>- Cấu hình biến môi trường `.env` và kiểm tra an toàn credentials. | **Hoàn thành 100%** |
| **5** | **Đánh giá & Kiểm thử Chất lượng (QA/Eval)** | **Thu Trang & Nhóm QA** | - Xây dựng bộ dữ liệu Pilot 4 văn bản chính thức VKU và 12 kịch bản câu hỏi.<br>- Viết CLI tự động tính toán Hit Rate@K, MRR và Citation Precision.<br>- Đánh giá đáp án Fake/Bedrock đối chiếu với Ground Truth. | **Đang tiến hành kiểm thử mở rộng** |

---

## 3. RANH GIỚI TRÁCH NHIỆM & TIÊU CHÍ BÀN GIAO (HANDOVER CRITERIA)

### 3.1. Ranh giới Frontend (React/Vite)
* **Trách nhiệm:**
  - Đảm bảo giao diện người dùng hoạt động mượt mà, phản hồi tức thì, không bị tràn cuộn hay đẩy lệch thanh nhập liệu.
  - Tuân thủ nghiêm ngặt Request Body của `POST /api/chat`, không gửi trường thừa (đáp ứng `extra="forbid"` của Backend).
  - Phân tích và hiển thị trích dẫn nguồn RAG (`sources`) đầy đủ các trường: `source_id`, `title`, `url`, `page_or_section`, `applicable_year`.
  - Hiển thị rõ ràng các mã lỗi hệ thống từ Error Envelope (`request_id`, thông điệp tiếng Việt, nút thử lại).
  - Duy trì chế độ Mock độc lập giúp kiểm thử và thuyết trình đồ án mà không bị phụ thuộc vào môi trường backend.

### 3.2. Ranh giới Backend (FastAPI)
* **Trách nhiệm:**
  - Cung cấp các probe endpoint `/health` và `/ready` phản ánh chính xác trạng thái sẵn sàng của vector store và LLM adapter.
  - Phục vụ API `POST /api/chat` với thời gian xử lý tối ưu, kiểm soát ngân sách ngữ cảnh và trích dẫn chuẩn xác.
  - Bọc tất cả phản hồi lỗi (422, 429, 502, 503, 504) vào Error Envelope chuẩn: `{ "error": { "code", "message", "request_id" } }`.
  - Gán header `X-Request-ID` cho mọi phản hồi để phục vụ truy vết lỗi toàn trình.
  - Bảo đảm bảo mật: Không lưu credentials trong code, không in dữ liệu người dùng ra access log.

---

## 4. KẾ HOẠCH TRIỂN KHAI & TIẾN ĐỘ THỰC HIỆN

```
Tuần 1: Khảo sát luồng nghiệp vụ & Thiết kế API Contract (Frontend + Backend)  [HOÀN THÀNH]
Tuần 2: Xây dựng RAG Core (Chunking, E5, FAISS) & Mock API Engine           [HOÀN THÀNH]
Tuần 3: Tích hợp Bedrock Converse, Source Citations & Giao diện React        [HOÀN THÀNH]
Tuần 4: Đồng bộ API Contract E2E, Kiểm thử Pilot, Tối ưu UI/UX & Tài liệu hóa [HOÀN THÀNH]
Giai đoạn tới: Lưu trữ phiên hỏi đáp (DynamoDB), Quản trị tải lên tự động    [KẾ HOẠCH]
```
