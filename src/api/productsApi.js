import { http } from "./client.js";
import { buildListParams, normalizePage } from "./paging.js";

// API sản phẩm (UC10) — /api/v1/products.
// LƯU Ý: không bao giờ gửi param `keyword` — backend hiện lỗi 500 ở đường
// tìm kiếm này (ProductSpecs join association không tồn tại). Khi backend
// sửa xong mới bật lại ô tìm kiếm.
export const productsApi = {
  async list({ uiPage = 1, size = 20, categoryId, status } = {}) {
    const params = buildListParams({ uiPage, size, filters: { categoryId, status } });
    const page = await http.get("/products", { params });
    return normalizePage(page);
  },
  detail(id) {
    return http.get(`/products/${id}`);
  },
  // payload: { name, categoryId, description, imageUrl, defaultSize, status }
  create(payload) {
    return http.post("/products", payload);
  },
  update(id, payload) {
    return http.put(`/products/${id}`, payload);
  },
  // Backend không có PATCH status cho sản phẩm: xoá mềm = đặt INACTIVE.
  softDelete(id) {
    return http.delete(`/products/${id}`);
  },
  hardDelete(id) {
    return http.delete(`/products/${id}/permanent`);
  },
};
