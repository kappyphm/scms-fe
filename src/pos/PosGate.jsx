import { Spinner } from "react-bootstrap";
import { useAuth } from "../auth/AuthContext.jsx";
import { usePosCashier } from "./posCashierStore.js";
import PosUnlockScreen from "./PosUnlockScreen.jsx";

// Cổng vào POS (FE-34): có phiên đăng nhập web (COO/quản lý) thì
// vào thẳng POS như trước; không có phiên thì POS là máy bán hàng
// chuyên dụng — phải mở máy bằng PIN thu ngân (PosUnlockScreen).
export default function PosGate({ children }) {
  const { status, user } = useAuth();
  const cashier = usePosCashier();

  if (status === "restoring") {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "60vh" }}>
        <Spinner className="me-2" /> Đang tải…
      </div>
    );
  }
  if (user || cashier) return children;
  return <PosUnlockScreen />;
}
