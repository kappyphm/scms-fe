import { http } from "./client.js";

// API ca làm & két tiền (UC08, UC24-UC27): mở/đóng ca, nạp/rút tiền mặt
// (bắt buộc PIN quản lý), tổng hợp ca hiện tại và lịch phân ca.
// GET /shifts/current trả 422 SHIFT_NOT_OPEN khi chi nhánh chưa mở ca —
// trang ca xử lý riêng trạng thái đó, không coi là lỗi.
export const shiftsApi = {
  open: (body) => http.post("/shifts/open", body),
  current: (branchId) => http.get("/shifts/current", { params: { branchId } }),
  cashIn: (shiftId, body) => http.post(`/shifts/${shiftId}/cash-in`, body),
  cashOut: (shiftId, body) => http.post(`/shifts/${shiftId}/cash-out`, body),
  close: (shiftId, body) => http.post(`/shifts/${shiftId}/close`, body),
  createSchedule: (body) => http.post("/shifts/schedules", body),
  listSchedules: (branchId, startDate, endDate) =>
    http.get("/shifts/schedules", { params: { branchId, startDate, endDate } }),
};

export const SHIFT_TYPE_LABELS = {
  MORNING: "Ca sáng",
  EVENING: "Ca tối",
  NIGHT: "Ca đêm",
};

export const SHIFT_STATUS = {
  SCHEDULED: { label: "Đã lên lịch", variant: "warn" },
  OPEN: { label: "Đang mở", variant: "success" },
  CLOSED: { label: "Đã đóng", variant: "neutral" },
};

export const CASH_TXN_LABELS = {
  OPEN: "Mở két đầu ca",
  CASH_IN: "Nạp tiền vào két",
  CASH_OUT: "Rút tiền khỏi két",
  REFUND_OUT: "Hoàn tiền cho khách",
  CLOSE: "Đóng két cuối ca",
};
