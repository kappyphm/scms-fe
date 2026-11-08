import { RouteLink } from "../router/HashRouter.jsx";

// Admin shell (FE-26, chỉ đạo 2026-11-09): KHÔNG còn sidebar — điều hướng
// duy nhất là panel link ở trang tổng quan theo vai trò (điểm bắt đầu của
// mọi luồng). Topbar giữ brand (bấm về "/" → RootDispatch đưa về panel của
// vai trò hiện tại), tên chi nhánh và vùng phiên làm việc.
export default function AdminLayout({ branchName = null, headerRight = null, children }) {
  return (
    <div className="admin-shell">
      <header className="topbar">
        <RouteLink
          to="/"
          className="topbar__brand"
          style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}
          title="Về trang tổng quan"
        >
          <span className="brand-mark">SC</span>
          <span>SCMS</span>
          {branchName ? <span className="topbar__branch">{branchName}</span> : null}
        </RouteLink>
        <div className="d-flex align-items-center gap-3">{headerRight}</div>
      </header>
      <main className="admin-content">{children}</main>
    </div>
  );
}
