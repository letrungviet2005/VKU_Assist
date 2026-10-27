# VKU Assist - Frontend & Tích hợp API

Ứng dụng giao diện Trợ lý Học vụ & Tuyển sinh Trường Đại học Công nghệ Thông tin và Truyền thông Việt - Hàn (VKU).

- **Thành viên phụ trách:** Thanh Vương
- **Nhánh phát triển:** `feature/frontend-API-integration`
- **Báo cáo chi tiết:** [Xem file BAO_CAO_THANH_VUONG_FRONTEND_API.md ở thư mục gốc](../BAO_CAO_THANH_VUONG_FRONTEND_API.md)

---

## 🚀 Khởi chạy nhanh

```bash
# Cài đặt thư viện
npm install

# Khởi chạy server phát triển
npm run dev
```

Mở trình duyệt tại: `http://localhost:5173/`

## 🛠️ Chế độ hoạt động
Hệ thống tích hợp bộ chuyển đổi hai chiều tại thanh Header:
- **Dữ liệu mẫu (VKU Mock):** Chạy độc lập tức thì với kho tri thức học vụ giả lập, không phụ thuộc backend.
- **Backend thật (Port 8000):** Kết nối với FastAPI Backend tại `http://127.0.0.1:8000/api/chat`.

## 🔑 Tài khoản Quản trị viên
- Tên đăng nhập: `admin`
- Mật khẩu: `vku2026` (hoặc `admin123`)
