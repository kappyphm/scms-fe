import { Button } from "react-bootstrap";
import { useRouter } from "../router/HashRouter.jsx";

// Task shell (mục 5.2): một tác vụ = một màn hình — header có nút quay lại
// + mã màn hình, nội dung, thanh hành động sticky ở đáy.
export default function TaskLayout({ title, screenCode = null, backTo = null, actions = null, children }) {
  const { navigate } = useRouter();

  return (
    <div className="task-shell">
      <header className="task-head">
        {backTo ? (
          <Button variant="outline-secondary" size="sm" onClick={() => navigate(backTo)}>
            ← Quay lại
          </Button>
        ) : null}
        <h2 className="mb-0 flex-grow-1">{title}</h2>
        {screenCode ? <span className="screen-code">{screenCode}</span> : null}
      </header>
      <main className="task-body">{children}</main>
      {actions ? <footer className="task-actions">{actions}</footer> : null}
    </div>
  );
}
