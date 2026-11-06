# SCMS Frontend (scms-fe)

Frontend của Smart Cafe Management System (SCMS) — bản cặp với backend `scms-be`
(repo `vucodeverse/scms-be`, clone local ở thư mục kề bên: `../scms-be`).

> **Trạng thái:** mới khởi tạo khung dự án + setup môi trường. Chưa code tính năng —
> chờ tài liệu prototype và style guide bổ sung, code sẽ làm theo các tài liệu đó.

## Stack

- React 19 + JavaScript, Vite 8
- React Bootstrap 2 + Bootstrap 5 (CSS đã import sẵn trong `src/main.jsx`)
- Axios (gọi API), npm quản lý package

## Chạy local

Cần Node.js (máy dev đang dùng Node 26 / npm 11).

```bash
npm install
npm run dev        # http://localhost:5173
```

Lệnh khác: `npm run build`, `npm run preview`, `npm run lint`.

## Kết nối backend khi dev

1. Chạy backend ở thư mục kề bên (cần JDK 21 và MySQL, profile `dev`):

   ```bash
   cd ../scms-be
   SPRING_PROFILES_ACTIVE=dev ./mvnw spring-boot:run   # http://localhost:8080
   ```

2. FE đọc địa chỉ API từ biến môi trường `VITE_API_BASE_URL` (file `.env`, mẫu ở
   `.env.example`): mặc định `http://localhost:8080/api/v1`.
   Backend đã mở CORS cho origin `http://localhost:5173` nên giữ nguyên cổng dev này.

## Ghi chú hợp đồng API (từ review scms-be 05/11/2026)

- Mọi response được bọc envelope `ApiResponse<T>`: `code`, `data`, `message`, `traceId`.
- Phân trang dùng `PageResponse`: `content`, `page`, `size`, `totalElements`, `totalPages`.
- Access token sống 30 phút; refresh token **xoay vòng** (mỗi lần refresh phải ghi đè token mới).
- `GET /api/v1/auth/me` trả `role` + `permissions` để ẩn/hiện menu; login trả `landing`
  (SCR-10: COO, SCR-07: Branch Manager, SCR-04: Cashier).
- Lưu ý tạm thời: không gửi param `keyword` lên `GET /api/v1/products` (backend đang lỗi 500 ở
  đường này); tìm kiếm ở danh mục/voucher/nhân viên/chi nhánh bình thường.
