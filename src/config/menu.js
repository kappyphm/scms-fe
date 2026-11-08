// Điều hướng theo đúng prototype (NS.ui.sidebar trong core.js): ba kiểu nav
// theo VAI TRÒ — chain (COO), branch (Quản lý chi nhánh), cashier (Thu ngân) —
// giữ đúng nhóm, nhãn và thứ tự của prototype.
//
// Không lọc theo permission: prototype không lọc, và dữ liệu quyền phía
// backend không cấp POS_OPERATE / SHIFT_OPEN cho bất kỳ vai trò nào đăng
// nhập được (chỉ Thu ngân có, mà Thu ngân không có tài khoản đăng nhập),
// khiến POS và Ca quỹ biến mất khỏi mọi luồng màn hình. Các mục prototype
// có nhưng backend chưa có luồng (Báo cáo, Audit Logs, Phê duyệt) không
// đưa vào menu để tránh mục chết.
const NAVS = {
  chain: [
    {
      group: "Tổng quan",
      items: [
        { key: "chain-overview", label: "Tổng quan chuỗi", path: "/chain/overview", icon: "dashboard" },
        { key: "branch-overview", label: "Tổng quan chi nhánh", path: "/branch/overview", icon: "branch" },
      ],
    },
    {
      group: "Master data",
      items: [
        { key: "menu", label: "Menu & BOM", path: "/chain/menu", icon: "menu" },
        { key: "vouchers", label: "Khuyến mãi", path: "/chain/vouchers", icon: "tag" },
        { key: "branches", label: "Chi nhánh & Manager", path: "/chain/branches", icon: "branch" },
        { key: "sync", label: "Đồng bộ chuỗi", path: "/settings/sync", icon: "sync" },
      ],
    },
    {
      group: "Hệ thống",
      items: [
        { key: "sepay", label: "SePay & thanh toán", path: "/settings/sepay", icon: "wallet" },
        { key: "roles", label: "Vai trò & phân quyền", path: "/settings/roles", icon: "settings" },
      ],
    },
  ],
  branch: [
    {
      group: "Vận hành",
      items: [
        { key: "branch-overview", label: "Tổng quan chi nhánh", path: "/branch/overview", icon: "dashboard" },
        { key: "pos", label: "POS bán hàng", path: "/pos", icon: "pos" },
        { key: "orders", label: "Đơn hàng", path: "/branch/orders", icon: "orders" },
        { key: "shift", label: "Ca quỹ", path: "/branch/shift", icon: "cash" },
      ],
    },
    {
      group: "Quản lý chi nhánh",
      items: [
        { key: "inventory", label: "Kho nguyên liệu", path: "/branch/inventory", icon: "inventory" },
        { key: "employees", label: "Nhân sự & ca", path: "/branch/employees", icon: "users" },
        { key: "payroll", label: "Bảng lương", path: "/branch/payroll", icon: "wallet" },
      ],
    },
  ],
  cashier: [
    {
      group: "Bán hàng",
      items: [
        { key: "pos", label: "POS bán hàng", path: "/pos", icon: "pos" },
        { key: "orders", label: "Đơn hàng", path: "/branch/orders", icon: "orders" },
        { key: "shift", label: "Ca quỹ", path: "/branch/shift", icon: "cash" },
      ],
    },
  ],
};

// Menu theo vai trò của người dùng hiện tại (trường `role` từ /auth/me).
// Nhân viên quầy (WAITER/BARISTA) không có tài khoản đăng nhập — bề mặt của
// họ là kiosk — nên không có menu shell.
export function buildMenu(user) {
  if (!user) return [];
  const role = String(user.role || user.roleCode || "").toUpperCase();
  if (role === "COO") return NAVS.chain;
  if (role === "BRANCH_MANAGER") return NAVS.branch;
  if (role === "CASHIER") return NAVS.cashier;
  return [];
}
