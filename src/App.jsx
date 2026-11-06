import { useEffect } from "react";
import { Spinner } from "react-bootstrap";
import { HashRouter, Routes, useRouter } from "./router/HashRouter.jsx";
import { ToastProvider } from "./components/ToastContext.jsx";
import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import { RequireAuth, RequireRole } from "./auth/guards.jsx";
import { landingPath } from "./auth/landing.js";
import LoginPage from "./pages/LoginPage.jsx";
import RoleHomePage from "./pages/RoleHomePage.jsx";
import MenuPage from "./pages/MenuPage.jsx";
import ProductEditPage from "./pages/menu/ProductEditPage.jsx";
import VouchersPage from "./pages/VouchersPage.jsx";
import VoucherEditPage from "./pages/VoucherEditPage.jsx";
import {
  ShowcaseAdminPage,
  ShowcaseAuthPage,
  ShowcaseKioskPage,
  ShowcaseTaskPage,
} from "./showcase/ShowcasePage.jsx";
import SessionShowcasePage from "./showcase/SessionShowcasePage.jsx";

// Điểm vào "/": đã đăng nhập -> trang đích theo vai trò (SCR-03);
// chưa đăng nhập -> SCR-01 Đăng nhập.
function RootDispatch() {
  const { status, user } = useAuth();
  const { navigate } = useRouter();

  useEffect(() => {
    if (status === "authenticated" && user) navigate(landingPath({ user }));
    else if (status === "anonymous") navigate("/login");
  }, [status, user, navigate]);

  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "60vh" }}>
      <Spinner className="me-2" /> Đang tải…
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes
            routes={[
              { pattern: "/", render: () => <RootDispatch /> },
              { pattern: "/login", render: () => <LoginPage /> },
              {
                pattern: "/chain/overview",
                render: () => (
                  <RequireAuth>
                    <RoleHomePage title="Tổng quan chuỗi" screenCode="SCR-10" />
                  </RequireAuth>
                ),
              },
              {
                pattern: "/branch/overview",
                render: () => (
                  <RequireAuth>
                    <RoleHomePage title="Tổng quan chi nhánh" screenCode="SCR-07" />
                  </RequireAuth>
                ),
              },
              {
                pattern: "/pos",
                render: () => (
                  <RequireAuth>
                    <RoleHomePage title="Bán hàng" screenCode="SCR-04" />
                  </RequireAuth>
                ),
              },
              {
                pattern: "/chain/menu",
                render: () => (
                  <RequireAuth>
                    <RequireRole roles={["COO"]}>
                      <MenuPage />
                    </RequireRole>
                  </RequireAuth>
                ),
              },
              {
                pattern: "/chain/menu/edit",
                render: () => (
                  <RequireAuth>
                    <RequireRole roles={["COO"]}>
                      <ProductEditPage />
                    </RequireRole>
                  </RequireAuth>
                ),
              },
              {
                pattern: "/chain/vouchers",
                render: () => (
                  <RequireAuth>
                    <RequireRole roles={["COO"]}>
                      <VouchersPage />
                    </RequireRole>
                  </RequireAuth>
                ),
              },
              {
                pattern: "/chain/vouchers/edit",
                render: () => (
                  <RequireAuth>
                    <RequireRole roles={["COO"]}>
                      <VoucherEditPage />
                    </RequireRole>
                  </RequireAuth>
                ),
              },
              { pattern: "/_showcase", render: () => <ShowcaseAdminPage /> },
              { pattern: "/_showcase/session", render: () => <SessionShowcasePage /> },
              { pattern: "/_showcase/auth", render: () => <ShowcaseAuthPage /> },
              { pattern: "/_showcase/kiosk", render: () => <ShowcaseKioskPage /> },
              { pattern: "/_showcase/task", render: () => <ShowcaseTaskPage /> },
            ]}
            fallback={<RootDispatch />}
          />
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  );
}
