import { useEffect } from "react";
import { HashRouter, Routes, useRouter } from "./router/HashRouter.jsx";
import { ToastProvider } from "./components/ToastContext.jsx";
import {
  ShowcaseAdminPage,
  ShowcaseAuthPage,
  ShowcaseKioskPage,
  ShowcaseTaskPage,
} from "./showcase/ShowcasePage.jsx";

// FE-01: mới có nền tảng + showcase nội bộ. Route "/" tạm điều hướng về
// showcase; màn hình đăng nhập (FE-03) sẽ thay thế điểm vào này.
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
        <Routes
          routes={[
            { pattern: "/", render: () => <RootRedirect /> },
            { pattern: "/_showcase", render: () => <ShowcaseAdminPage /> },
            { pattern: "/_showcase/auth", render: () => <ShowcaseAuthPage /> },
            { pattern: "/_showcase/kiosk", render: () => <ShowcaseKioskPage /> },
            { pattern: "/_showcase/task", render: () => <ShowcaseTaskPage /> },
          ]}
          fallback={<ShowcaseAdminPage />}
        />
      </ToastProvider>
    </HashRouter>
  );
}
