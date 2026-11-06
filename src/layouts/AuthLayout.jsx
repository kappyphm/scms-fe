// Auth shell (tài liệu thiết kế mục 5.2): split-screen,
// trái là khối thương hiệu, phải là form (SCR-01 dùng shell này).
export default function AuthLayout({ screenCode = "SCR-01", children }) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand">
        <div className="d-flex align-items-center gap-2">
          <span className="brand-mark">SC</span>
          <strong>SCMS</strong>
        </div>
        <div>
          <h1 className="mb-2">Smart Cafe Management System</h1>
          <p className="text-muted-scms" style={{ maxWidth: 420 }}>
            Hệ thống quản lý chuỗi cà phê — vận hành chi nhánh, bán hàng và quản trị chuỗi
            trên một nền tảng.
          </p>
        </div>
        <span className="screen-code">{screenCode}</span>
      </aside>
      <main className="auth-main">
        <div className="auth-box">{children}</div>
      </main>
    </div>
  );
}
