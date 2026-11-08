import { http } from "./client.js";

// API bảng lương (UC45): kỳ lương theo chi nhánh, các dòng lương được hệ
// thống lập từ chấm công hoàn tất trong kỳ (giờ công x đơn giá giờ + phụ
// cấp - khấu trừ), quản lý chỉnh thưởng/khấu trừ khi kỳ còn nháp, gửi
// duyệt và COO duyệt hoặc trả lại kèm lý do.
// Lưu ý: sửa dòng lương chỉ gồm bonus / deduction / note — phụ cấp do
// backend tính cố định theo vị trí.
export const payrollApi = {
  createPeriod: (body) => http.post("/payroll/periods", body),
  listPeriods: (branchId) => http.get("/payroll/periods", { params: { branchId } }),
  listItems: (periodId) => http.get(`/payroll/periods/${periodId}/items`),
  updateItem: (itemId, body) => http.put(`/payroll/items/${itemId}`, body),
  submit: (periodId) => http.post(`/payroll/periods/${periodId}/submit`),
  approve: (periodId) => http.post(`/payroll/periods/${periodId}/approve`),
  reject: (periodId, reason) =>
    http.post(`/payroll/periods/${periodId}/reject`, null, { params: { reason } }),
};

export const PAY_PERIOD_STATUS = {
  DRAFT: { label: "Nháp", variant: "warn" },
  SUBMITTED: { label: "Chờ duyệt", variant: "neutral" },
  APPROVED: { label: "Đã duyệt", variant: "success" },
  PAID: { label: "Đã chi trả", variant: "dark" },
};
