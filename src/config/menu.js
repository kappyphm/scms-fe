import { PERMISSIONS } from "./permissions.js";

// Cấu trúc menu chính của Admin shell. Mục hiển thị khi người dùng có quyền
// tương ứng trong `permissions` của /auth/me (đúng chủ đích PermissionCatalog
// của backend). Các route nghiệp vụ sẽ được các issue màn hình tương ứng
// hoàn thiện; khai báo tập trung tại đây để menu nhất quán.
export const APP_MENU = [
  {
    group: "Vận hành",
    items: [
      { key: "branch-overview", label: "Tổng quan chi nhánh", path: "/branch/overview", permission: PERMISSIONS.REPORT_VIEW },
      { key: "chain-overview", label: "Tổng quan chuỗi", path: "/chain/overview", permission: PERMISSIONS.REPORT_VIEW },
    ],
  },
  {
    group: "Master data",
    items: [
      { key: "branches", label: "Chi nhánh", path: "/chain/branches", permission: PERMISSIONS.BRANCH_MANAGE },
      { key: "employees", label: "Nhân viên", path: "/branch/employees", permission: PERMISSIONS.EMPLOYEE_MANAGE },
      { key: "menu", label: "Menu & sản phẩm", path: "/chain/menu", permission: PERMISSIONS.MENU_MANAGE },
      { key: "vouchers", label: "Khuyến mãi & voucher", path: "/chain/vouchers", permission: PERMISSIONS.VOUCHER_MANAGE },
      { key: "roles", label: "Vai trò & phân quyền", path: "/settings/roles", permission: PERMISSIONS.ROLE_ASSIGN },
    ],
  },
];

// Lọc menu theo permissions của người dùng hiện tại; nhóm rỗng bị loại.
export function buildMenu(user) {
  if (!user) return [];
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return APP_MENU.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.permission || permissions.includes(item.permission)),
  })).filter((section) => section.items.length > 0);
}
