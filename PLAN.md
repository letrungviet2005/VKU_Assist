# KẾ HOẠCH TRIỂN KHAI & NÂNG CẤP HỆ THỐNG VKU ASSIST
**Hệ thống Trợ lý ảo Học vụ & Tuyển sinh Thông minh VKU**  
**Người lập kế hoạch:** Nhóm Dự án VKU Assist  
**Thời gian áp dụng:** 2026  

---

## 1. MỤC TIÊU DỰ ÁN

1. Xây dựng nền tảng hỏi đáp học vụ và tư vấn tuyển sinh tự động cho sinh viên và thí sinh Trường Đại học Công nghệ Thông tin và Truyền thông Việt - Hàn (VKU).
2. Ứng dụng công nghệ RAG (Retrieval-Augmented Generation) kết hợp mô hình ngôn ngữ lớn (Amazon Bedrock) bảo đảm câu trả lời 100% có dẫn chứng từ văn bản chính thức của Nhà trường.
3. Đồng bộ hóa toàn diện giữa giao diện người dùng React/Vite và dịch vụ Backend FastAPI qua chuẩn API Contract chặt chẽ.

---

## 2. KẾ HOẠCH CHI TIẾT THEO CÁC GIAI ĐOẠN

### GIAI ĐOẠN 1: HẠT NHÂN RAG & HỎI ĐÁP ĐƠN LƯỢT (ĐÃ HOÀN THÀNH)
* **Retriever Engine:**
  - Tiền xử lý PDF/Markdown/TXT với chuẩn hóa tiếng Việt Unicode.
  - Phân đoạn thông minh theo tokenizer `multilingual-e5-small` (300 tokens/chunk, 50 tokens overlap).
  - Lập chỉ mục FAISS IndexFlatIP trên CPU kết hợp vector L2-normalization.
  - Quản lý bundle bất biến (`indexes/<version>`) và con trỏ nguyên tử `active.json`.
* **LLM & Grounding:**
  - Tích hợp Amazon Bedrock Converse API và Fake Adapter cho môi trường phát triển cục bộ.
  - Xây dựng System Prompt định hướng trích dẫn nguồn `[S1]`, `[S2]`.
  - Pydantic response schema `ModelAnswer` (3 trạng thái: `answered`, `needs_clarification`, `insufficient_evidence`).
  - Hàng rào bảo vệ chống ảo giác (Anti-hallucination guardrails).
* **Frontend & Tích hợp:**
  - Giao diện Tra cứu & Hỏi đáp React/Vite với bố cục Rigid Shell 100vh.
  - Bộ chuyển mạch 2 chiều: Dữ liệu mẫu (VKU Mock) và Backend thật (Port 8000).
  - Đồng bộ hợp đồng API Contract, hiển thị Thẻ Căn cứ văn bản `SourceCard`.
  - Quản lý phiên hội thoại và bộ lọc danh mục/năm học.

### GIAI ĐOẠN 2: QUẢN TRỊ KHO TRI THỨC & LƯU TRỮ PHIÊN HỘI THOẠI (HIỆN TẠI)
* **Backend:**
  - Triển khai API thu thập đánh giá của sinh viên `POST /api/feedback` ghi nhận độ chính xác của câu trả lời.
  - Triển khai quản lý phiên làm việc đa lượt (Multi-turn conversation memory) kết nối kho lưu trữ DynamoDB hoặc Redis.
  - Triển khai API Quản trị viên: Đăng nhập (`POST /api/admin/login`), danh sách văn bản (`GET /api/admin/documents`), upload tài liệu mới và job xử lý nền.
* **Frontend:**
  - Nối kết các modal Feedback và Dashboard Quản trị viên với backend API khi có token admin.
  - Kiểm thử tải (Load testing) và kiểm thử E2E kịch bản chuyển đổi mạng.

### GIAI ĐOẠN 3: NÂNG CẤP TRẢI NGHIỆM & SẢN XUẤT QUY MÔ LỚN
* **Tìm kiếm lai (Hybrid Search):** Kết hợp tìm kiếm từ khóa BM25 và tìm kiếm ngữ nghĩa Dense Vector E5.
* **Mô hình Tái xếp hạng (Re-ranking):** Áp dụng mô hình Cross-Encoder để tối ưu hóa thứ hạng các đoạn trích dẫn trước khi nạp vào LLM.
* **Phản hồi luồng (Streaming SSE):** Chuyển đổi sang Server-Sent Events (SSE) để hiển thị câu trả lời dạng gõ chữ thời gian thực, giảm độ trễ cảm nhận của người dùng.
* **Mở rộng dữ liệu:** Tự động hóa crawler cập nhật thông báo mới từ cổng thông tin đào tạo `daotao.vku.udn.vn`.

---

## 3. MA TRẬN RỦI RO & PHƯƠNG ÁN GIẢM THIỂU

| Rủi ro kỹ thuật | Mức độ | Phương án phòng ngừa & Xử lý |
| :--- | :---: | :--- |
| **LLM sinh câu trả lời ảo giác hoặc sai nguồn** | Cao | Bắt buộc schema `ModelAnswer`, regex kiểm tra trích dẫn nội dòng khớp chính xác với ID ngữ cảnh đã cung cấp; fallback về `insufficient_evidence` khi không có context. |
| **Mất kết nối mạng tới AWS Bedrock** | Trung bình | Cơ chế Timeout cấu hình được (`LLM_READ_TIMEOUT`), Error Envelope trả 504 `bedrock_timeout`; Frontend có cơ chế Retry và Fallback Mock Engine tức thì. |
| **Quá tải CPU khi nhiều người hỏi đồng thời** | Cao | Sử dụng `BoundedSemaphore` (`CHAT_MAX_CONCURRENCY = 2`) giới hạn slot xử lý đồng thời, trả lỗi 429 thân thiện thay vì làm sập tiến trình. |
| **Lệch cấu trúc hợp đồng giữa Frontend & Backend** | Trung bình | Định nghĩa Schema Pydantic chặt chẽ (`extra="forbid"`), tài liệu hóa API Contract tập trung tại `docs/architecture.md`. |
