import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "react-bootstrap";
import { RouteLink, useRouter } from "../router/HashRouter.jsx";
import Icon from "../components/Icon.jsx";
import { useToast } from "../components/ToastContext.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { formatVnd } from "../lib/format.js";
import { productsApi } from "../api/productsApi.js";
import { categoriesApi } from "../api/categoriesApi.js";
import { branchesApi } from "../api/branchesApi.js";
import { ordersApi } from "../api/ordersApi.js";
import { shiftsApi } from "../api/shiftsApi.js";
import { posCart, usePosCart, lineTotal, cartSubtotal, cartCount } from "../pos/posCartStore.js";

// SCR-04 — POS bán hàng (FE-27): chép đúng prototype views-pos.js —
// shell riêng toàn màn hình, topbar tối (brand về trang tổng quan, chi
// nhánh, trạng thái ca, lối sang Đơn hàng / Ca quỹ, đồng hồ, người dùng),
// rail danh mục có số món, lưới thẻ món, panel "Đơn hiện tại". Bấm món
// mở màn hình tuỳ chỉnh POP-01; nút Thanh toán tạo đơn ở backend rồi
// sang màn hình thanh toán POP-02.
export default function PosPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const { lines, voucherCode, pendingOrderId } = usePosCart();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(user?.branchId || null);
  const [shift, setShift] = useState(null);
  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState(null);
  const [voucherInput, setVoucherInput] = useState(voucherCode || "");
  const [voucherMsg, setVoucherMsg] = useState("");
  const [creating, setCreating] = useState(false);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prodPage, cats] = await Promise.all([
        productsApi.list({ uiPage: 1, size: 100, status: "AVAILABLE" }),
        categoriesApi.listAll(),
      ]);
      setProducts(prodPage.items || []);
      setCategories((cats || []).filter((c) => c.status === "ACTIVE"));
      if (!user?.branchId) {
        const brPage = await branchesApi.list({ uiPage: 1, size: 100 });
        const open = (brPage.items || []).filter((b) => b.status === "OPEN");
        setBranches(open);
        if (open.length) setBranchId((cur) => cur || open[0].id);
      }
    } catch (err) {
      toastRef.current.error(err.message || "Không tải được menu bán hàng.");
    } finally {
      setLoading(false);
    }
  }, [user?.branchId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    shiftsApi
      .current(branchId)
      .then((sum) => {
        if (!cancelled) setShift(sum?.shift || null);
      })
      .catch(() => {
        if (!cancelled) setShift(null);
      });
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const branch = useMemo(() => {
    if (user?.branchId) return { id: user.branchId, code: "", name: user.branchName || "" };
    return branches.find((b) => b.id === branchId) || null;
  }, [branches, branchId, user]);

  const visibleProducts = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return products.filter(
      (p) => (!categoryId || p.categoryId === categoryId) && (!kw || p.name.toLowerCase().includes(kw))
    );
  }, [products, keyword, categoryId]);

  const subtotal = cartSubtotal(lines);
  const count = cartCount(lines);
  const locked = Boolean(pendingOrderId);

  function openItem(product) {
    if (locked) {
      toast.error("Đang có đơn chờ thanh toán — hoàn tất đơn đó trước khi tạo đơn mới.");
      return;
    }
    navigate(`/pos/item?id=${product.id}`);
  }

  function applyVoucher() {
    const code = voucherInput.trim().toUpperCase();
    posCart.setVoucher(code);
    setVoucherMsg(code ? `Mã ${code} sẽ được áp dụng khi thanh toán.` : "");
  }

  async function checkout() {
    if (!lines.length || creating) return;
    if (locked) {
      navigate(`/pos/checkout?id=${pendingOrderId}`);
      return;
    }
    if (!shift) {
      toast.error("Vui lòng mở ca quỹ trước khi thanh toán.");
      return;
    }
    setCreating(true);
    try {
      const order = await ordersApi.create({
        branchId,
        totalAmount: subtotal,
        discountAmount: 0,
        finalAmount: subtotal,
        lines: lines.map((l) => ({
          productId: l.productId,
          size: l.size,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          sugarLevel: l.sugar,
          iceLevel: l.ice,
          note: l.note || undefined,
          toppingIds: (l.toppings || []).map((t) => t.toppingId),
        })),
      });
      if (voucherCode) {
        try {
          await ordersApi.applyVoucher(order.id, voucherCode);
        } catch (err) {
          toast.error(`Không áp dụng được voucher: ${err.message || "mã không hợp lệ"}`);
        }
      }
      posCart.setPendingOrderId(order.id);
      navigate(`/pos/checkout?id=${order.id}`);
    } catch (err) {
      toast.error(err.message || "Không tạo được đơn hàng.");
    } finally {
      setCreating(false);
    }
  }

  const shiftTime = shift?.openedAt || shift?.plannedStart || shift?.createdAt;
  const shiftLabel = shift
    ? `Ca ${shiftTime ? new Date(shiftTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : ""}${user?.fullName ? ` · ${user.fullName}` : ""}`
    : "Chưa mở ca";

  return (
    <div className="pos-shell">
      <div className="pos-top">
        <div className="topbar__left">
          <RouteLink className="brand" to="/" style={{ textDecoration: "none" }}>
            <span className="brand__mark">SC</span>
            <span className="brand__name">SCMS POS</span>
          </RouteLink>
          {user?.branchId ? (
            <span className="topbar__branch" style={{ color: "#d8d2c8" }}>
              {branch?.name || ""}
            </span>
          ) : (
            <select
              aria-label="Chi nhánh bán hàng"
              value={branchId || ""}
              onChange={(e) => setBranchId(Number(e.target.value))}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.name}
                </option>
              ))}
            </select>
          )}
          <span className="topbar__meta">
            <Icon name="clock" size={13} /> {shiftLabel}
          </span>
        </div>
        <div className="topbar__right">
          <RouteLink className="btn btn-sm" to="/branch/orders">
            Đơn hàng
          </RouteLink>
          <RouteLink className="btn btn-sm" to="/branch/shift">
            Ca quỹ
          </RouteLink>
          <span className="topbar__clock">
            {clock.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <span className="avatar" title={user?.fullName || ""}>
            {(user?.fullName || "?")
              .split(" ")
              .slice(-2)
              .map((x) => x[0])
              .join("")
              .toUpperCase()}
          </span>
        </div>
      </div>

      <div className="pos-body">
        <aside className="pos-categories">
          <button type="button" className={"cat" + (!categoryId ? " active" : "")} onClick={() => setCategoryId(null)}>
            Tất cả <span>{products.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={"cat" + (categoryId === c.id ? " active" : "")}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name} <span>{products.filter((p) => p.categoryId === c.id).length}</span>
            </button>
          ))}
          {user?.role !== "CASHIER" ? (
            <>
              <div className="divider mt-16 mb-12" />
              <RouteLink className="nav-item" to="/branch/inventory">
                <span className="nav-item__icon">
                  <Icon name="inventory" size={16} />
                </span>
                <span>Kho nguyên liệu</span>
              </RouteLink>
              <RouteLink className="nav-item" to="/">
                <span className="nav-item__icon">
                  <Icon name="dashboard" size={16} />
                </span>
                <span>Chi nhánh</span>
              </RouteLink>
            </>
          ) : null}
        </aside>

        <section className="pos-products">
          {!loading && !shift ? (
            <div className="notice notice--warn pos-notice">
              <span className="notice__icon">!</span>
              <div>
                <strong>Chưa mở ca quỹ.</strong> Bạn vẫn có thể tạo đơn tạm, nhưng cần{" "}
                <RouteLink className="text-accent" to="/branch/shift">
                  mở ca
                </RouteLink>{" "}
                trước khi thanh toán tiền mặt.
              </div>
            </div>
          ) : null}
          <div className="pos-search">
            <Icon name="search" size={18} />
            <input
              className="input input-lg"
              placeholder="Tìm tên hoặc mã món…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div className="pos-products-head">
            <h2>{categoryId ? categories.find((c) => c.id === categoryId)?.name || "Toàn bộ menu" : "Toàn bộ menu"}</h2>
            <span className="small muted">
              {visibleProducts.length} món khả dụng ·{" "}
              {new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </span>
          </div>
          {loading ? (
            <div className="text-center py-5">
              <Spinner className="me-2" /> Đang tải…
            </div>
          ) : (
            <div className="product-grid">
              {visibleProducts.map((p) => {
                const minPrice = Math.min(...(p.sizes || []).map((s) => Number(s.price)));
                return (
                  <button key={p.id} type="button" className="product" onClick={() => openItem(p)}>
                    <div className="product__image">
                      {p.name
                        .split(" ")
                        .map((x) => x[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="product__body">
                      <div className="product__name">{p.name}</div>
                      <div className="small muted">{p.categoryName || ""}</div>
                      <div className="product__price">Từ {formatVnd(minPrice)}</div>
                    </div>
                  </button>
                );
              })}
              {visibleProducts.length === 0 ? (
                <div className="text-muted">Không tìm thấy món. Thử từ khóa khác hoặc chọn danh mục khác.</div>
              ) : null}
            </div>
          )}
        </section>

        <aside className="pos-cart">
          <div className="cart-head">
            <div className="flex justify-between items-center">
              <h2>Đơn hiện tại</h2>
              <span className="badge-count">{count}</span>
            </div>
            <div className="meta">
              {user?.fullName || ""} · {shift ? shiftLabel.replace("Ca ", "Ca ") : "Chưa mở ca"}
            </div>
          </div>

          {locked ? (
            <div className="notice notice--accent" style={{ margin: "10px 16px 0" }}>
              <span className="notice__icon">i</span>
              <div>
                <strong>Đơn đang chờ thanh toán.</strong> Hoàn tất ở màn hình thanh toán; nếu bỏ, đơn vẫn nằm
                trong danh sách Đơn hàng ở trạng thái chờ.
              </div>
            </div>
          ) : null}

          <div className="cart-lines">
            {lines.length ? (
              lines.map((l) => {
                const opts = [l.size, l.sugar, l.ice, ...(l.toppings || []).map((t) => t.name)]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div className="cart-line" key={l.key}>
                    <div className="cart-line__main">
                      <div className="cart-line__name">{l.name}</div>
                      <div className="cart-line__opts">
                        {opts || "Mặc định"}
                        {l.note ? ` · ${l.note}` : ""}
                      </div>
                      <div className="cart-line__tools">
                        <span className="qty">
                          <button type="button" aria-label="Giảm" disabled={locked} onClick={() => posCart.setQuantity(l.key, l.quantity - 1)}>
                            −
                          </button>
                          <span>{l.quantity}</span>
                          <button type="button" aria-label="Tăng" disabled={locked} onClick={() => posCart.setQuantity(l.key, l.quantity + 1)}>
                            +
                          </button>
                        </span>
                        <button
                          type="button"
                          className="link-btn"
                          disabled={locked}
                          onClick={() => navigate(`/pos/item?id=${l.productId}&line=${encodeURIComponent(l.key)}`)}
                        >
                          Sửa
                        </button>
                        <button type="button" className="link-btn" disabled={locked} onClick={() => posCart.removeLine(l.key)}>
                          Xóa
                        </button>
                      </div>
                    </div>
                    <div className="cart-line__price">{formatVnd(lineTotal(l))}</div>
                  </div>
                );
              })
            ) : (
              <div className="text-muted" style={{ padding: "18px 0", fontSize: 12 }}>
                Giỏ hàng trống. Chọn món từ menu để bắt đầu đơn mới.
              </div>
            )}
          </div>

          <div className="cart-foot">
            <div className="voucher-row">
              <input
                className="input"
                placeholder="Mã voucher"
                value={voucherInput}
                onChange={(e) => setVoucherInput(e.target.value)}
                disabled={locked}
              />
              <button type="button" className="btn btn-sm" onClick={applyVoucher} disabled={locked}>
                Áp dụng
              </button>
            </div>
            {voucherMsg ? <div className="small mb-8" style={{ color: "var(--muted)" }}>{voucherMsg}</div> : null}
            <div className="summary-line">
              <span>Tạm tính ({count} món)</span>
              <strong>{formatVnd(subtotal)}</strong>
            </div>
            <div className="summary-line">
              <span>Giảm giá</span>
              <strong>{voucherCode ? "Tính khi thanh toán" : "—"}</strong>
            </div>
            <div className="summary-line total">
              <span>Tổng thanh toán</span>
              <strong>{formatVnd(subtotal)}</strong>
            </div>
            <div className="cart-actions" style={{ gridTemplateColumns: "1fr" }}>
              <button type="button" className="btn btn-primary" disabled={!lines.length || creating} onClick={checkout}>
                {creating ? "Đang tạo đơn…" : locked ? "Tiếp tục thanh toán" : "Thanh toán"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
