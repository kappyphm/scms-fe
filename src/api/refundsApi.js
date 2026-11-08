import { http } from "./client.js";

// API hoàn tiền (UC23). Điều kiện phía backend: đơn đã thanh toán, số tiền
// không vượt phần còn lại của đơn, bắt buộc PIN của quản lý chi nhánh và
// chi nhánh phải đang có ca mở để xuất tiền khỏi két (BR-34).
export const refundsApi = {
  create: (body) => http.post("/refunds", body),
};
