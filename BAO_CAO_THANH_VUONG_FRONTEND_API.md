# BÁO CÁO TỔNG HỢP NHIỆM VỤ & TÍCH HỢP FRONTEND - API CONTRACT
**Hệ thống Trợ lý ảo Học vụ & Tuyển sinh VKU Assist**  
**Người thực hiện:** Thanh Vương  
**Nhánh (Branch):** `feature/frontend-API-integration`  
**Kho mã nguồn:** [https://github.com/letrungviet2005/VKU_Assist.git](https://github.com/letrungviet2005/VKU_Assist.git)

---

## 1. TỔNG QUAN PHÂN CÔNG NHIỆM VỤ

Căn cứ theo bản kế hoạch triển khai dự án VKU Assist (`VKU_Assist_Ke_hoach_trien_khai_hoan_thien.docx`), thành viên **Thanh Vương** được phân công phụ trách toàn diện hợp phần **Frontend & Tích hợp API Contract (Frontend - Backend Adapter)** với lộ trình 4 tuần:

| Giai đoạn | Nhiệm vụ chính được giao | Trạng thái |
| :--- | :--- | :---: |
| **Tuần 1** | Khảo sát luồng nghiệp vụ học vụ, thiết kế kiến trúc giao tiếp Frontend - Backend, thống nhất hợp đồng API Chat & RAG. | **Hoàn thành 100%** |
| **Tuần 2** | Chuẩn hóa Schema Pydantic, xây dựng Mock API Engine giả lập tri thức học vụ VKU độc lập, xử lý Error Envelope đồng bộ. | **Hoàn thành 100%** |
| **Tuần 3** | Phát triển giao diện Tra cứu & Hỏi đáp sinh viên, hiển thị trích dẫn nguồn RAG (`sources`), giao diện Quản trị kho văn bản. | **Hoàn thành 100%** |
| **Tuần 4** | Kiểm thử E2E, tối ưu UX/UI theo kích thước cửa sổ tùy ý, bộ chuyển mạch Mock/Backend 2 chiều, phân quyền Header Admin, tài liệu hóa. | **Hoàn thành 100%** |

---

## 2. BÁO CÁO KẾT QUẢ TÍCH HỢP TỪNG API HỆ THỐNG

Frontend đã tích hợp và hoàn thiện toàn bộ các API theo đúng tài liệu kỹ thuật `docs/api.md` và `docs/chat.md`, sẵn sàng kết nối 2 chế độ: **Dữ liệu mẫu nội bộ (VKU Mock)** và **FastAPI Backend (Cổng 8000)**.

```
   ┌────────────────────────────────────────────────────────┐
   │             VKU Assist Frontend (React + Vite)         │
   │  - Segmented Mode Switch: [ Dữ liệu mẫu | Backend ]    │
   └──────────────┬──────────────────────────┬──────────────┘
                  │                          │
        (Backend Mode / HTTP)        (Mock Mode / Fallback)
                  │                          │
                  ▼                          ▼
   ┌───────────────────────────┐  ┌─────────────────────────┐
   │  FastAPI Backend (:8000)  │  │   Mock RAG Engine VKU   │
   │  - FAISS Vector Store     │  │   - Tri thức tuyển sinh │
   │  - Embedding CPU          │  │   - Quy chế đào tạo     │
   │  - Amazon Bedrock / Fake  │  │   - Học phí & học bổng  │
   └───────────────────────────┘  └─────────────────────────┘
```

### 2.1. API Tra cứu & Hỏi đáp (`POST /api/chat`)
* **Endpoint:** `POST http://127.0.0.1:8000/api/chat`
* **Headers:** `Content-Type: application/json`, `X-Request-ID: <UUID-v4>`
* **Request Payload Model:**
  ```json
  {
    "message": "Điều kiện xét học bổng khuyến khích học tập là gì?",
    "category": "hoc_vu",
    "applicable_year": 2026
  }
  ```
* **Xử lý 3 kịch bản phản hồi (Status):**
  1. `status: "answered"`: Trả lời kèm trích dẫn văn bản nguồn RAG (`sources`) gồm tên tài liệu, điều khoản, số trang và link gốc.
  2. `status: "needs_clarification"`: Khi câu hỏi quá ngắn hoặc thiếu thông tin (ví dụ: gõ "học phí"), hệ thống gợi ý sinh viên chọn khoa ngành/năm học cụ thể.
  3. `status: "insufficient_evidence"`: Khi dữ liệu không có trong kho văn bản chính thức VKU, hệ thống trung thực từ chối và cung cấp số điện thoại/hotline phòng Đào tạo & Tuyển sinh VKU.

### 2.2. API Kiểm tra Sống còn (`GET /health`)
* **Mục đích:** Health probe kiểm tra tiến trình FastAPI đang hoạt động.
* **Kết quả xử lý:** Trả về `{ "status": "ok" }` hoặc cảnh báo offline trên giao diện nếu backend chưa khởi động.

### 2.3. API Kiểm tra Sẵn sàng RAG (`GET /ready`)
* **Mục đích:** Readiness probe xác định FAISS Index và mô hình nhúng/LLM đã nạp thành công vào bộ nhớ hay chưa.
* **Kết quả xử lý:** Trả về `{ "ok": true, "index_version": "vku-index-2026.1" }`. Nếu chỉ mục chưa tạo, giao diện hiển thị cảnh báo `Backend: Chưa nạp index` và hướng dẫn chạy lệnh CLI.

### 2.4. API Quản lý Phiên hội thoại (`POST /api/sessions` & `GET /api/sessions/{id}/messages`)
* **Mục đích:** Khởi tạo session token ẩn danh cho sinh viên, lưu trữ lịch sử hỏi đáp, cho phép tạo hội thoại mới và xóa lịch sử có hộp thoại xác nhận an toàn.

### 2.5. API Thu thập Phản hồi Sinh viên (`POST /api/feedback`)
* **Mục đích:** Ghi nhận đánh giá Hữu ích (`helpful`) hoặc Chưa chuẩn xác (`not_helpful`) kèm nội dung góp ý của sinh viên để nâng cao độ chính xác của mô hình RAG.

### 2.6. API Quản trị viên (`POST /api/admin/login`, `GET/POST /api/admin/documents`, `GET /api/admin/jobs/{job_id}`)
* **Xác thực Admin:** Hỗ trợ đăng nhập với token an toàn.
* **Kho văn bản RAG:** Hiển thị danh sách văn bản (Đề án tuyển sinh, Quy chế tín chỉ, Biểu mức học phí), số lượng chunk, dung lượng và trạng thái indexing.
* **Tải lên tài liệu:** Cho phép upload PDF/DOCX, kích hoạt job xử lý nền và theo dõi tiến độ indexing theo thời gian thực.

---

## 3. BÁO CÁO KẾT QUẢ GIAO DIỆN & TỐI ƯU HÓA TRẢI NGHIỆM (UI/UX)

1. **Bộ chuyển mạch hai chiều độc lập (Segmented Switch):**
   * Đặt tại Header với 2 trạng thái rõ ràng: `[ Dữ liệu mẫu (VKU Mock) | Backend thật (Port 8000) ]`.
   * Khắc phục triệt để lỗi người dùng bị kẹt khi backend chưa chạy: Người dùng có thể chuyển về chế độ Mock bất cứ lúc nào với 1 click mà không bị alert chặn lại.
2. **Thanh Header thích ứng phân quyền:**
   * Khi ở chế độ tra cứu sinh viên: Hiển thị thanh menu công cộng, bộ chuyển Mock/Backend và nút chuyển Theme.
   * Khi đăng nhập Quản trị viên: Header chuyển sang giao diện Admin ("Khu vực Quản trị", nút "Quay lại Màn hình Tra cứu", huy hiệu "Administrator", nút "Đăng xuất").
3. **Bố cục khung nhìn hoàn hảo (Full Responsive):**
   * Sửa lỗi trôi/đẩy thanh nhập liệu và card Tri thức RAG: Đặt khung `app-shell` cố định `100vh; overflow: hidden`, chỉ cuộn luồng hội thoại.
   * Hoạt động mượt mà ở mọi kích thước: Cửa sổ thu nhỏ, chia đôi màn hình (Split screen) hoặc toàn màn hình. Có nút bật/tắt Sidebar RAG chủ động.
4. **Hệ màu chuẩn nhận diện Đại học VKU:**
   * Màu Cam VKU (`#E65100`), Xanh Navy (`#0D47A1`), Đỏ nhấn (`#C62828`).
   * Hỗ trợ đầy đủ Dark Mode (chế độ tối bảo vệ mắt) và Light Mode (chế độ sáng trang nhã).

---

## 4. HƯỚNG DẪN CÁCH CHẠY ỨNG DỤNG TRÊN BRANCH NÀY

### Bước 1: Clone và chuyển sang branch `feature/frontend-API-integration`
```powershell
git clone https://github.com/letrungviet2005/VKU_Assist.git
cd VKU_Assist
git checkout feature/frontend-API-integration
```

### Bước 2: Cài đặt và khởi chạy Frontend (Khuyên dùng)
```powershell
cd frontend
npm install
npm run dev
```
Truy cập trình duyệt tại: **`http://localhost:5173/`**  
*Mặc định hệ thống chạy ngay với chế độ **Dữ liệu mẫu (VKU Mock)**, cho phép bạn trải nghiệm đầy đủ tính năng tra cứu tuyển sinh, học bổng, quy chế tín chỉ và trang Quản trị mà không cần cài Python.*

* **Tài khoản quản trị thử nghiệm:**
  * Tên đăng nhập: `admin`
  * Mật khẩu: `vku2026` (hoặc `admin123`)

### Bước 3: (Tùy chọn) Chạy kết hợp với Backend FastAPI
Nếu muốn thử nghiệm kết nối backend thật cổng 8000:
```powershell
# Tại thư mục gốc repository
py -3.11 -m venv backend/.venv
& ./backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
cd backend
if (!(Test-Path .env)) { Copy-Item .env.example .env }
$env:CHAT_ENABLED = 'true'
$env:LLM_PROVIDER = 'fake'
$env:RETRIEVAL_ENABLED = 'false'
& ./.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Sau đó trên giao diện web `http://localhost:5173/`, bấm chuyển sang **`Backend thật (Port 8000)`** tại thanh Header.

---

## 5. TỔNG KẾT
Toàn bộ phần việc được giao cho thành viên **Thanh Vương** đã được hoàn thành đúng hạn, tuân thủ nghiêm ngặt hợp đồng API và chất lượng trải nghiệm người dùng cao cấp. Mã nguồn được tổ chức sạch sẽ, có đầy đủ chú thích tiếng Việt và được lưu trữ trên nhánh `feature/frontend-API-integration`.
