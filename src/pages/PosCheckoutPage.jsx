import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "react-bootstrap";
import TaskLayout from "../layouts/TaskLayout.jsx";
import Icon from "../components/Icon.jsx";
import { useRouter } from "../router/HashRouter.jsx";
import { useToast } from "../components/ToastContext.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { formatVnd } from "../lib/format.js";
import { ordersApi } from "../api/ordersApi.js";
import { paymentsApi } from "../api/paymentsApi.js";
import { posCart } from "../pos/posCartStore.js";
import { usePosCashier } from "../pos/posCashierStore.js";

const QUICK_AMOUNTS = [100000, 200000, 500000];

// POP-02 — Thanh toán đơn hàng (FE-27): chép đúng prototype views-pos
// checkout — thẻ tóm tắt đơn bên trái, hộp thanh toán bên phải với tab
// Tiền mặt / VietQR-SePay. Tiền mặt: tiền khách đưa + nút số tiền nhanh
// + tiền thối, chặn xác nhận khi chưa đủ tiền. VietQR: mã QR thật từ
// backend, tự kiểm tra trạng thái mỗi 3 giây (webhook SePay). Thanh
// toán xong hiện màn hình biên lai như prototype (không có nút in —
// backend chưa có luồng in UC21/22).
export default function PosCheckoutPage() {
  const { query, navigate } = useRouter();
  const { user } = useAuth();
  const cashier = usePosCashier();
  const operatorName = user?.fullName || cashier?.name || "";
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const orderId = Number(query.id);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState("cash");
  const [cash, setCash] = useState("");
  const [paying, setPaying] = useState(false);
  const [qr, setQr] = useState(null);
  const [paidInfo, setPaidInfo] = useState(null);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const detail = await ordersApi.detail(orderId);
      setOrder(detail);
      if (detail.status === "PAID" || detail.status === "PARTIALLY_REFUNDED") {
        const st = await paymentsApi.getStatus(orderId).catch(() => null);
        setPaidInfo(st);
        posCart.clear();
      }
    } catch (err) {
      toastRef.current.error(err.message || "Không tải được đơn hàng.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const done = Boolean(paidInfo) || order?.status === "PAID" || order?.status === "PARTIALLY_REFUNDED";
  const finalAmount = Number(order?.finalAmount || 0);
  const cashNum = Number(cash || 0);
  const change = Math.max(0, cashNum - finalAmount);

  // VietQR: tạo mã khi chọn tab, poll trạng thái tới khi đơn được trả.
  useEffect(() => {
    if (method !== "vietqr" || !order || done || qr) return;
    let cancelled = false;
    paymentsApi
      .createVietQr(orderId)
      .then((res) => {
        if (!cancelled) setQr(res);
      })
      .catch((err) => toastRef.current.error(err.message || "Không tạo được mã VietQR."));
    return () => {
      cancelled = true;
    };
  }, [method, order, done, qr, orderId]);

  useEffect(() => {
    if (method !== "vietqr" || !order || done) return undefined;
    pollRef.current = setInterval(async () => {
      try {
        const st = await paymentsApi.getStatus(orderId);
        if (st.orderStatus === "PAID" || st.orderStatus === "PARTIALLY_REFUNDED") {
          setPaidInfo(st);
          posCart.clear();
          const fresh = await ordersApi.detail(orderId).catch(() => null);
          if (fresh) setOrder(fresh);
        }
      } catch {
        /* bỏ qua lỗi poll */
      }
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [method, order, done, orderId]);

  async function confirmCash() {
    if (cashNum < finalAmount) {
      toast.error("Tiền khách đưa chưa đủ tổng thanh toán.");
      return;
    }
    setPaying(true);
    try {
      const res = await paymentsApi.payCash({ orderId, cashReceived: cashNum });
      setPaidInfo(res);
      posCart.clear();
      const fresh = await ordersApi.detail(orderId).catch(() => null);
      if (fresh) setOrder(fresh);
      toast.success("Đã thanh toán tiền mặt.");
    } catch (err) {
      toast.error(err.message || "Thanh toán thất bại.");
    } finally {
      setPaying(false);
    }
  }

  async function confirmQrManual() {
    try {
      const st = await paymentsApi.getStatus(orderId);
      if (st.orderStatus === "PAID" || st.orderStatus === "PARTIALLY_REFUNDED") {
        setPaidInfo(st);
        posCart.clear();
        const fresh = await ordersApi.detail(orderId).catch(() => null);
        if (fresh) setOrder(fresh);
      } else {
        toast.error("Chưa ghi nhận được thanh toán — hệ thống tự cập nhật khi webhook SePay về.");
      }
    } catch (err) {
      toast.error(err.message || "Không kiểm tra được trạng thái thanh toán.");
    }
  }

  if (loading) {
    return (
      <TaskLayout title="Thanh toán đơn hàng" screenCode="POP-02" backTo="/pos">
        <div className="text-center py-5">
          <Spinner className="me-2" /> Đang tải…
        </div>
      </TaskLayout>
    );
  }

  if (!order) {
    return (
      <TaskLayout title="Chưa có đơn thanh toán" screenCode="POP-02" backTo="/pos">
        <div className="scms-panel panel-pad text-muted">
          Không có đơn chờ thanh toán. Quay lại POS để tạo đơn mới.
        </div>
      </TaskLayout>
    );
  }

  if (done) {
    const received = paidInfo?.cashReceived ?? paidInfo?.receivedAmount;
    const changeBack = paidInfo?.changeReturned ?? (received != null ? Math.max(0, Number(received) - finalAmount) : null);
    return (
      <TaskLayout
        title="Thanh toán thành công"
        subtitle="Đơn đã được khóa dữ liệu. Bạn có thể tạo đơn mới."
        screenCode="POP-02"
        backTo="/pos"
        meta={<span className="tag tag-done">Đã thanh toán</span>}
      >
        <div className="success-box">
          <div className="success-box__mark">
            <Icon name="check" size={26} />
          </div>
          <h1>Đã thanh toán</h1>
          <p>
            Đơn <strong>{order.receiptNo}</strong> đã hoàn tất
            {paidInfo?.paymentMethod === "CASH" || paidInfo?.cashReceived != null
              ? " với tiền mặt"
              : paidInfo?.paymentMethod
                ? " qua VietQR/SePay"
                : ""}
            .
          </p>
          <div className="receipt">
            <div className="receipt__head">
              <strong>{user?.branchName || "SCMS"}</strong>
              <div className="small muted">
                {order.receiptNo} ·{" "}
                {order.paidAt || order.createdAt
                  ? new Date(order.paidAt || order.createdAt).toLocaleString("vi-VN")
                  : ""}
              </div>
            </div>
            {(order.lines || []).map((l) => (
              <div className="receipt__line" key={l.id}>
                <span>
                  {l.quantity} × {l.productName} ({l.size})
                </span>
                <span>{formatVnd(l.lineTotal)}</span>
              </div>
            ))}
            <div className="receipt__line">
              <span>Giảm giá</span>
              <span>−{formatVnd(order.discountAmount)}</span>
            </div>
            <div className="receipt__line receipt__total">
              <span>Tổng thanh toán</span>
              <span>{formatVnd(order.finalAmount)}</span>
            </div>
            {received != null ? (
              <>
                <div className="receipt__line">
                  <span>Tiền nhận</span>
                  <span>{formatVnd(received)}</span>
                </div>
                <div className="receipt__line">
                  <span>Tiền thối</span>
                  <span>{formatVnd(changeBack || 0)}</span>
                </div>
              </>
            ) : paidInfo?.referenceCode ? (
              <div className="receipt__line">
                <span>Mã giao dịch</span>
                <span>{paidInfo.referenceCode}</span>
              </div>
            ) : null}
          </div>
          <div className="flex gap-8 mt-24" style={{ justifyContent: "center" }}>
            <button type="button" className="btn btn-primary" onClick={() => navigate("/pos")}>
              Tạo đơn mới
            </button>
          </div>
        </div>
      </TaskLayout>
    );
  }

  return (
    <TaskLayout
      title="Thanh toán đơn hàng"
      subtitle="Kiểm tra đơn và chọn phương thức thanh toán. Đơn sẽ bị khóa sau khi xác nhận."
      screenCode="POP-02"
      backTo="/pos"
      meta={
        <>
          <span className="tag tag-pending">Chưa thanh toán</span>{" "}
          <span className="tag tag-neutral">
            {(order.lines || []).reduce((s, l) => s + l.quantity, 0)} món
          </span>
        </>
      }
      footer={
        <>
          <span className="task-footer__note">
            Thanh toán sẽ ghi nhận vào ca quỹ hiện tại.
          </span>
          <div className="flex gap-8">
            <button type="button" className="btn" onClick={() => navigate("/pos")}>
              Quay lại
            </button>
            {method === "cash" ? (
              <button type="button" className="btn btn-primary" onClick={confirmCash} disabled={paying}>
                {paying ? "Đang xử lý…" : "Xác nhận thanh toán"}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={confirmQrManual}>
                Tôi đã nhận chuyển khoản
              </button>
            )}
          </div>
        </>
      }
    >
      <div className="checkout-layout">
        <div className="checkout-summary">
          <div className="checkout-summary__head">
            <div className="flex justify-between">
              <div>
                <div className="page-code">ĐƠN {order.receiptNo}</div>
                <h2 style={{ fontSize: 17 }}>{operatorName}</h2>
                <div className="small muted">
                  {user?.branchName || ""} ·{" "}
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString("vi-VN") : ""}
                </div>
              </div>
              <span className="tag tag-pending">Chưa thanh toán</span>
            </div>
          </div>
          <div className="checkout-items">
            {(order.lines || []).map((l) => {
              const opts = [
                l.size,
                l.sugarLevel,
                l.iceLevel,
                ...(l.toppings || []).map((t) => t.toppingName),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <div className="checkout-item" key={l.id}>
                  <div>
                    <div className="cell-title">
                      {l.quantity} × {l.productName}
                    </div>
                    <div className="small muted">{opts}</div>
                  </div>
                  <strong>{formatVnd(l.lineTotal)}</strong>
                </div>
              );
            })}
          </div>
          <div className="checkout-totals">
            <div className="summary-line">
              <span>Tạm tính</span>
              <strong>{formatVnd(order.totalAmount)}</strong>
            </div>
            <div className="summary-line">
              <span>Giảm giá{order.voucher?.voucherCode ? ` · ${order.voucher.voucherCode}` : ""}</span>
              <strong>−{formatVnd(order.discountAmount)}</strong>
            </div>
            <div className="summary-line total">
              <span>Tổng thanh toán</span>
              <strong>{formatVnd(order.finalAmount)}</strong>
            </div>
          </div>
        </div>

        <div className="pay-box">
          <div className="pay-tabs">
            <button type="button" className={"pay-tab" + (method === "cash" ? " active" : "")} onClick={() => setMethod("cash")}>
              Tiền mặt
            </button>
            <button
              type="button"
              className={"pay-tab" + (method === "vietqr" ? " active" : "")}
              onClick={() => setMethod("vietqr")}
            >
              VietQR / SePay
            </button>
          </div>

          {method === "cash" ? (
            <>
              <div className="field">
                <label htmlFor="checkout-cash">Tiền khách đưa</label>
                <input
                  className="input input-lg"
                  id="checkout-cash"
                  inputMode="numeric"
                  placeholder="Nhập số tiền"
                  value={cash}
                  onChange={(e) => setCash(e.target.value.replace(/[^\d]/g, ""))}
                />
              </div>
              <div className="quick-cash mt-8">
                {QUICK_AMOUNTS.map((n) => (
                  <button key={n} type="button" onClick={() => setCash(String(n))}>
                    {formatVnd(n)}
                  </button>
                ))}
                <button type="button" onClick={() => setCash(String(finalAmount))}>
                  Đúng tiền
                </button>
              </div>
              <div className="change-box">
                <span className="small muted">Tiền thối</span>
                <strong>{formatVnd(change)}</strong>
              </div>
              <div className="notice mt-12">
                <span className="notice__icon">i</span>
                <div>Thanh toán tiền mặt được ghi nhận vào ca quỹ đang mở của chi nhánh.</div>
              </div>
            </>
          ) : (
            <>
              {qr ? (
                <div className="qr-box">
                  <img src={qr.qrImageUrl} alt="Mã VietQR" style={{ width: 200, height: 200 }} />
                  <div className="qr-meta">
                    <strong>{formatVnd(qr.amount)}</strong>
                    <span>Nội dung: {qr.referenceCode}</span>
                    <span>
                      Ngân hàng: {qr.bankName} · {qr.accountNumber}
                    </span>
                    {qr.expiresAt ? (
                      <span>Hết hạn: {new Date(qr.expiresAt).toLocaleTimeString("vi-VN")}</span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Spinner className="me-2" /> Đang tạo mã QR…
                </div>
              )}
              <div className="notice notice--warn mt-12">
                <span className="notice__icon">!</span>
                <div>
                  <strong>Đang chờ webhook SePay.</strong> Trang tự kiểm tra trạng thái mỗi 3 giây; đơn chuyển
                  đã thanh toán ngay khi tiền về.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </TaskLayout>
  );
}
