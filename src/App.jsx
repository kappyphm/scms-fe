import { useEffect } from "react";
import { HashRouter, Routes, useRouter } from "./router/HashRouter.jsx";
import { ToastProvider } from "./components/ToastContext.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import {
  ShowcaseAdminPage,
  ShowcaseAuthPage,
  ShowcaseKioskPage,
  ShowcaseTaskPage,
} from "./showcase/ShowcasePage.jsx";
import SessionShowcasePage from "./showcase/SessionShowcasePage.jsx";

// Giai đoạn nền tảng (FE-01 + FE-02): route "/" tạm điều hướng về showcase.
// Màn hình đăng nhập (FE-03) sẽ thay thế điểm vào này.
function RootRedirect() {
  const { navigate } = useRouter();
  useEffect(() => {
    navigate("/_showcase");
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes
            routes={[
              { pattern: "/", render: () => <RootRedirect /> },
              { pattern: "/_showcase", render: () => <ShowcaseAdminPage /> },
              { pattern: "/_showcase/session", render: () => <SessionShowcasePage /> },
              { pattern: "/_showcase/auth", render: () => <ShowcaseAuthPage /> },
              { pattern: "/_showcase/kiosk", render: () => <ShowcaseKioskPage /> },
              { pattern: "/_showcase/task", render: () => <ShowcaseTaskPage /> },
            ]}
            fallback={<ShowcaseAdminPage />}
          />
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  );
}
