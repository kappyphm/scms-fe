import { http } from "./client.js";
import { buildListParams, normalizePage } from "./paging.js";

// API người dùng / nhân sự (UC06/UC07) — /api/v1/users.
// FE-05 dùng tối thiểu: liệt kê + tạo tài khoản Branch Manager cho
// chi nhánh. FE-06 sẽ mở rộng cho màn hình nhân viên đầy đủ.
export const usersApi = {
  async list({ uiPage = 1, size = 20, keyword, role, branchId, status } = {}) {
    const params = buildListParams({
      uiPage,
      size,
      sortBy: "createdAt",
      sortDir: "DESC",
      filters: { keyword, role, branchId, status },
    });
    const page = await http.get("/users", { params });
    return normalizePage(page);
  },
  detail(id) {
    return http.get(`/users/${id}`);
  },
  create(payload) {
    return http.post("/users", payload);
  },
  update(id, payload) {
    return http.put(`/users/${id}`, payload);
  },
  changeStatus(id, status) {
    return http.patch(`/users/${id}/status`, { status });
  },
};
