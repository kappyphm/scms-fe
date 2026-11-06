import { RouteLink, useRouter } from "../router/HashRouter.jsx";

// Admin shell (tài liệu thiết kế mục 5.2): top rail 56px + sidebar 244px + content.
// menu: [{ group, items: [{ key, label, path, badge }] }]
export default function AdminLayout({
  menu = [],
  branchName = null,
  headerRight = null,
  screenCode = null,
  children,
}) {
  const { path } = useRouter();
  // Item active là item có path khớp dài nhất (tránh hai item cùng active
  // khi một path là tiền tố của path khác, ví dụ /_showcase và /_showcase/session).
  const allPaths = menu.flatMap((s) => s.items.map((i) => i.path));
  const bestMatch = allPaths
    .filter((p) => path === p || path.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <div className="admin-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="brand-mark">SC</span>
          <span>SCMS</span>
          {branchName ? <span className="topbar__branch">{branchName}</span> : null}
        </div>
        <div className="d-flex align-items-center gap-3">
          {screenCode ? <span className="screen-code">{screenCode}</span> : null}
          {headerRight}
        </div>
      </header>

      <div className="admin-body">
        <nav className="sidebar" aria-label="Điều hướng chính">
          {menu.map((section) => (
            <div key={section.group}>
              <div className="sidebar__group">{section.group}</div>
              {section.items.map((item) => {
                const active = item.path === bestMatch;
                return (
                  <RouteLink
                    key={item.key}
                    to={item.path}
                    className={`sidebar__item${active ? " active" : ""}`}
                  >
                    <span className="sidebar__label">{item.label}</span>
                    {item.badge ? <span className="sidebar__badge">{item.badge}</span> : null}
                  </RouteLink>
                );
              })}
            </div>
          ))}
        </nav>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
