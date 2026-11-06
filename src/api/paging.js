// Hỗ trợ danh sách phân trang khớp backend:
// request: page (0-based), size, sortBy, sortDir + các filter riêng.
// response PageResponse: { items, page, size, totalItems, totalPages }.
// Phía giao diện, page hiển thị từ 1 — helper này chịu trách nhiệm quy đổi.

// uiPage bắt đầu từ 1. Trả về object params sẵn sàng truyền cho axios.
export function buildListParams({ uiPage = 1, size = 20, sortBy, sortDir, filters = {} }) {
  const params = { page: Math.max(0, uiPage - 1), size };
  if (sortBy) {
    params.sortBy = sortBy;
    params.sortDir = sortDir || "asc";
  }
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") params[key] = value;
  }
  return params;
}

// Chuẩn hoá PageResponse về dạng UI dùng: page hiển thị từ 1.
export function normalizePage(pageResponse) {
  if (!pageResponse) return { items: [], uiPage: 1, size: 20, totalItems: 0, totalPages: 0 };
  return {
    items: pageResponse.items || [],
    uiPage: (pageResponse.page ?? 0) + 1,
    size: pageResponse.size ?? 20,
    totalItems: pageResponse.totalItems ?? 0,
    totalPages: pageResponse.totalPages ?? 0,
  };
}
