import { http } from "./client.js";

// API đồng bộ cấu hình chuỗi (UC14, chỉ COO): đẩy danh mục, món và voucher
// từ cấp chuỗi xuống các chi nhánh được chọn.
export const syncApi = {
  syncToBranches: (body) => http.post("/chain-sync", body),
};
