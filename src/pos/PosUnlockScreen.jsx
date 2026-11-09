import { useEffect, useRef, useState } from "react";
import { Button, Form, Spinner } from "react-bootstrap";
import { useRouter } from "../router/HashRouter.jsx";
import { attendanceApi } from "../api/attendanceApi.js";
import { ROLE_LABELS } from "../auth/landing.js";
import { posCashier } from "./posCashierStore.js";

const NUMPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];

// Màn hình mở máy POS (FE-34, cách user chốt): thu ngân nhập PIN 4
// số; FE gọi check-in chấm công bằng {branchId, pin} — BE tự tra
// nhân viên theo PIN. Chỉ role CASHIER mới mở được POS. Nếu nhân
// viên đã vào ca (lỗi ATTENDANCE_ALREADY_CHECKED_IN — chỉ xảy ra
// sau khi PIN đã khớp), vẫn mở máy nhưng không có tên (BE không
// trả danh tính ở nhánh lỗi). Khóa máy không check-out.
export default function PosUnlockScreen() {
  const { query, navigate } = useRouter();

  const [branchId, setBranchId] = useState(() => {
    const fromQuery = query.branchId ? Number(query.branchId) : null;
    if (fromQuery) {
      posCashier.setTerminalBranch(fromQuery);
      return fromQuery;
    }
    return posCashier.getTerminalBranch();
  });
  const [branchInput, setBranchInput] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const busyRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  function applyBranch() {
    const id = Number(branchInput);
    if (!id) return;
    posCashier.setTerminalBranch(id);
    setBranchId(id);
    setError("");
  }

  function resetBranch() {
    posCashier.clearTerminalBranch();
    setBranchId(null);
    setPin("");
    setError("");
  }

  async function tryUnlock(pinValue) {
    if (busyRef.current || !branchId || pinValue.length !== 4) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const dto = await attendanceApi.checkIn({ branchId, pin: pinValue });
      if (dto.role !== "CASHIER") {
        setError(
          `Mã PIN thuộc về ${ROLE_LABELS[dto.role] || dto.role || "nhân viên"} — chỉ thu ngân mới mở được POS.`,
        );
        setPin("");
        return;
      }
      posCashier.set({ branchId, employeeId: dto.employeeId, name: dto.employeeName });
    } catch (err) {
      if (err.detailCode === "ATTENDANCE_ALREADY_CHECKED_IN") {
        // PIN đã khớp một nhân viên đang trong ca ở chi nhánh này.
        posCashier.set({ branchId, employeeId: null, name: "Thu ngân (đã vào ca)" });
      } else {
        setError(err.message || "Không mở được POS.");
        setPin("");
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function pressKey(key) {
    if (busy) return;
    if (key === "C") {
      setPin("");
      return;
    }
    if (key === "⌫") {
      setPin(pin.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 4) tryUnlock(next);
  }

  const dateLine = now.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="kiosk">
      <section className="kiosk-left">
        <div
          className="d-flex justify-content-between align-items-center"
          style={{ position: "relative", zIndex: 1 }}
        >
          <div className="d-flex align-items-center gap-2" style={{ color: "var(--surface)", fontWeight: 600 }}>
            <span className="brand__mark">SC</span>
            <span>SCMS · POS</span>
          </div>
          <Button
            size="sm"
            variant="outline-light"
            onClick={() => navigate("/login")}
            style={{ background: "transparent" }}
          >
            Đăng nhập quản lý
          </Button>
        </div>

        <div className="kiosk-clock-wrap">
          <div className="time">{now.toLocaleTimeString("vi-VN", { hour12: false })}</div>
          <div className="date">{dateLine}</div>
          <div className="server-note">
            Đồng hồ hệ thống{branchId ? ` · Máy POS chi nhánh #${branchId}` : " · Chưa thiết lập chi nhánh"}
          </div>
        </div>

        <div className="kiosk-reader">
          <div className="kiosk-reader__status">
            <span className="kiosk-reader__dot" />
            Máy bán hàng sẵn sàng
          </div>
          <p>Thu ngân nhập mã PIN 4 số để mở máy và bắt đầu bán hàng.</p>
        </div>
      </section>

      <section className="kiosk-right">
        <div className="kiosk-panel">
          <h1>Mở máy POS</h1>
          <p>Nhập mã PIN thu ngân — hệ thống tự nhận diện và ghi nhận vào ca chấm công.</p>

          {!branchId ? (
            <div>
              <Form.Group className="mb-3">
                <Form.Label>Thiết lập máy POS — ID chi nhánh</Form.Label>
                <Form.Control
                  size="lg"
                  type="number"
                  min="1"
                  value={branchInput}
                  onChange={(e) => setBranchInput(e.target.value)}
                  placeholder="Ví dụ: 1"
                />
                <Form.Text className="text-muted">
                  ID chi nhánh được quản trị viên cung cấp khi lắp máy; thiết lập được lưu trên máy này.
                </Form.Text>
              </Form.Group>
              <Button variant="primary" size="lg" className="w-100" onClick={applyBranch} disabled={!branchInput}>
                Bắt đầu
              </Button>
            </div>
          ) : (
            <>
              <div className="pin-display" aria-label="PIN đã nhập">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={`pin-dot ${i < pin.length ? "filled" : ""}`} />
                ))}
              </div>

              <div className="numpad">
                {NUMPAD.map((key) => (
                  <button key={key} type="button" data-key={key} disabled={busy} onClick={() => pressKey(key)}>
                    {key}
                  </button>
                ))}
              </div>

              {error ? (
                <div className="result-banner">
                  <div className="result-banner__title">
                    <span className="result-banner__mark">!</span>
                    Không mở được POS
                  </div>
                  <div className="result-banner__meta">
                    <span>
                      Lý do: <strong>{error}</strong>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="result-banner">
                  <div className="result-banner__title">
                    <span className="result-banner__mark">i</span>
                    Chờ mã PIN
                  </div>
                  <div className="result-banner__meta">
                    <span>
                      Kết quả: <strong>Sẵn sàng nhận PIN</strong>
                    </span>
                  </div>
                </div>
              )}

              <div className="d-flex justify-content-between align-items-center">
                <button type="button" className="kiosk-back" onClick={() => navigate("/login")}>
                  Đăng nhập quản lý
                </button>
                <button type="button" className="kiosk-back" onClick={resetBranch}>
                  Đổi chi nhánh máy
                </button>
              </div>
              {busy ? (
                <div className="text-center mt-2">
                  <Spinner size="sm" className="me-2" /> Đang kiểm tra PIN…
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
