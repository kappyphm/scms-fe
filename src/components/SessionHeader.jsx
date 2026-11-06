import { Button } from "react-bootstrap";
import { useAuth } from "../auth/AuthContext.jsx";
import { useRouter } from "../router/HashRouter.jsx";

// Khối góc phải top rail dùng chung cho các màn hình đã đăng nhập:
// thông tin người dùng hiện tại + nút Đăng xuất.
export default function SessionHeaderRight() {
  const { user, logout } = useAuth();
  const { navigate } = useRouter();

  return (
    <>
      <span className="small text-muted-scms">
        {user?.fullName} · {user?.role}
        {user?.branchName ? ` · ${user.branchName}` : ""}
      </span>
      <Button
        variant="outline-secondary"
        size="sm"
        onClick={async () => {
          await logout();
          navigate("/login");
        }}
      >
        Đăng xuất
      </Button>
    </>
  );
}
