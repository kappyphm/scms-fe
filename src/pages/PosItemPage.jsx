import { useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "react-bootstrap";
import TaskLayout from "../layouts/TaskLayout.jsx";
import { useRouter } from "../router/HashRouter.jsx";
import { useToast } from "../components/ToastContext.jsx";
import { formatVnd } from "../lib/format.js";
import { productsApi } from "../api/productsApi.js";
import { posCart } from "../pos/posCartStore.js";

const SUGAR_LEVELS = ["100%", "70%", "50%", "Không đường"];
const ICE_LEVELS = ["100% đá", "Ít đá", "Không đá"];

// POP-01 — Tuỳ chỉnh món (FE-27): chép đúng prototype views-pos
// posItem — các nhóm lựa chọn dạng thẻ (size, mức đường, mức đá,
// topping, ghi chú, số lượng) + panel tóm tắt giá bên phải. Dựng nháp
// mặc định như prototype: size M nếu có, đường 100%, đá 100%, không
// topping, số lượng 1. Mở từ nút Sửa của dòng giỏ thì nạp lại dòng đó.
export default function PosItemPage() {
  const { query, navigate } = useRouter();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const productId = Number(query.id);
  const lineKeyParam = query.line || null;

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await productsApi.list({ uiPage: 1, size: 100, status: "AVAILABLE" });
        const found = (page.items || []).find((p) => p.id === productId) || null;
        if (cancelled) return;
        setProduct(found);
        if (found) {
          const editing = lineKeyParam
            ? posCart.getLines().find((l) => l.key === decodeURIComponent(lineKeyParam))
            : null;
          if (editing) {
            setDraft({
              size: editing.size,
              sugar: editing.sugar,
              ice: editing.ice,
              toppingIds: (editing.toppings || []).map((t) => t.toppingId),
              note: editing.note || "",
              qty: editing.quantity,
            });
          } else {
            const sizes = found.sizes || [];
            setDraft({
              size: sizes.some((s) => s.size === "M") ? "M" : sizes[0]?.size || "S",
              sugar: "100%",
              ice: "100% đá",
              toppingIds: [],
              note: "",
              qty: 1,
            });
          }
        }
      } catch (err) {
        toastRef.current.error(err.message || "Không tải được món.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, lineKeyParam]);

  const sizePrice = useMemo(() => {
    if (!product || !draft) return 0;
    return Number((product.sizes || []).find((s) => s.size === draft.size)?.price || 0);
  }, [product, draft]);

  const selectedToppings = useMemo(() => {
    if (!product || !draft) return [];
    return (product.toppings || []).filter((t) => draft.toppingIds.includes(t.toppingId));
  }, [product, draft]);

  const unitPrice = sizePrice + selectedToppings.reduce((s, t) => s + Number(t.extraPrice || 0), 0);
  const total = draft ? unitPrice * draft.qty : 0;

  function submit() {
    if (!product || !draft) return;
    const line = {
      productId: product.id,
      name: product.name,
      categoryName: product.categoryName || "",
      size: draft.size,
      sugar: draft.sugar,
      ice: draft.ice,
      toppings: selectedToppings.map((t) => ({
        toppingId: t.toppingId,
        name: t.name,
        extraPrice: Number(t.extraPrice || 0),
      })),
      note: draft.note.trim(),
      quantity: draft.qty,
      unitPrice: sizePrice,
    };
    if (lineKeyParam) {
      posCart.replaceLine(decodeURIComponent(lineKeyParam), line);
    } else {
      posCart.addLine(line);
    }
    toast.success("Đã cập nhật giỏ hàng.");
    navigate("/pos");
  }

  if (loading) {
    return (
      <TaskLayout title="Tuỳ chỉnh món" screenCode="POP-01" backTo="/pos">
        <div className="text-center py-5">
          <Spinner className="me-2" /> Đang tải…
        </div>
      </TaskLayout>
    );
  }

  if (!product || !draft) {
    return (
      <TaskLayout title="Không tìm thấy món" screenCode="POP-01" backTo="/pos">
        <div className="scms-panel panel-pad text-muted">
          Món không tồn tại hoặc đang tạm ngưng bán. Quay lại POS và chọn món khác.
        </div>
      </TaskLayout>
    );
  }

  const initials = product.name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <TaskLayout
      title={product.name}
      subtitle={`Tuỳ chỉnh món trước khi thêm vào giỏ · ${product.categoryName || ""}`}
      screenCode="POP-01"
      backTo="/pos"
      meta={
        <>
          <span className="tag tag-neutral">{product.categoryName || ""}</span>{" "}
          <span className="tag tag-pending">{draft.size}</span>
        </>
      }
      footer={
        <>
          <span className="task-footer__note">Tuỳ chỉnh món không làm thay đổi đơn đã thanh toán.</span>
          <div className="flex gap-8">
            <button type="button" className="btn" onClick={() => navigate("/pos")}>
              Hủy
            </button>
            <button type="button" className="btn btn-primary" onClick={submit}>
              {lineKeyParam ? "Cập nhật món" : "Thêm vào giỏ"}
            </button>
          </div>
        </>
      }
    >
      <div className="option-layout">
        <div>
          <div className="option-group">
            <h2>Chọn size</h2>
            <p>Giá thay đổi theo dung tích ly.</p>
            <div className="choice-grid">
              {(product.sizes || []).map((s) => (
                <label key={s.size} className="choice">
                  <input
                    type="radio"
                    name="size"
                    checked={draft.size === s.size}
                    onChange={() => setDraft((d) => ({ ...d, size: s.size }))}
                  />
                  <span>
                    <strong>Size {s.size}</strong>
                    <small>{formatVnd(s.price)}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="option-group">
            <h2>Mức đường</h2>
            <div className="choice-grid">
              {SUGAR_LEVELS.map((s) => (
                <label key={s} className="choice">
                  <input
                    type="radio"
                    name="sugar"
                    checked={draft.sugar === s}
                    onChange={() => setDraft((d) => ({ ...d, sugar: s }))}
                  />
                  <span>
                    <strong>{s}</strong>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="option-group">
            <h2>Mức đá</h2>
            <div className="choice-grid">
              {ICE_LEVELS.map((s) => (
                <label key={s} className="choice">
                  <input
                    type="radio"
                    name="ice"
                    checked={draft.ice === s}
                    onChange={() => setDraft((d) => ({ ...d, ice: s }))}
                  />
                  <span>
                    <strong>{s}</strong>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {(product.toppings || []).length ? (
            <div className="option-group">
              <h2>Topping</h2>
              <p>Có thể chọn nhiều topping.</p>
              <div className="choice-grid">
                {(product.toppings || []).map((t) => (
                  <label key={t.toppingId} className="choice">
                    <input
                      type="checkbox"
                      checked={draft.toppingIds.includes(t.toppingId)}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          toppingIds: e.target.checked
                            ? [...d.toppingIds, t.toppingId]
                            : d.toppingIds.filter((x) => x !== t.toppingId),
                        }))
                      }
                    />
                    <span>
                      <strong>{t.name}</strong>
                      <small>+{formatVnd(t.extraPrice)}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="option-group">
            <h2>Ghi chú pha chế</h2>
            <p>Tối đa 100 ký tự.</p>
            <textarea
              className="textarea"
              maxLength={100}
              placeholder="Ví dụ: ít ngọt, đá riêng, không ống hút…"
              value={draft.note}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            />
          </div>

          <div className="option-group">
            <h2>Số lượng</h2>
            <div className="flex items-center gap-12">
              <span className="qty" style={{ height: 38 }}>
                <button type="button" onClick={() => setDraft((d) => ({ ...d, qty: Math.max(1, d.qty - 1) }))}>
                  −
                </button>
                <span style={{ minWidth: 40 }}>{draft.qty}</span>
                <button type="button" onClick={() => setDraft((d) => ({ ...d, qty: Math.min(20, d.qty + 1) }))}>
                  +
                </button>
              </span>
              <span className="small muted">Tối đa 20 món mỗi dòng.</span>
            </div>
          </div>
        </div>

        <aside className="item-summary">
          <div className="item-summary__image">{initials}</div>
          <div className="small muted mt-12">{product.categoryName || ""}</div>
          <h2>{product.name}</h2>
          <div className="price-big">{formatVnd(unitPrice)}</div>
          <div className="price-lines">
            <div className="price-line">
              <span>Size {draft.size}</span>
              <span>{formatVnd(sizePrice)}</span>
            </div>
            {selectedToppings.length ? (
              selectedToppings.map((t) => (
                <div className="price-line" key={t.toppingId}>
                  <span>{t.name}</span>
                  <span>+{formatVnd(t.extraPrice)}</span>
                </div>
              ))
            ) : (
              <div className="price-line">
                <span>Topping</span>
                <span>—</span>
              </div>
            )}
            <div className="price-line">
              <span>Đường / đá</span>
              <span>
                {draft.sugar} · {draft.ice}
              </span>
            </div>
            <div className="price-line">
              <span>Số lượng</span>
              <span>× {draft.qty}</span>
            </div>
            <div className="price-line total">
              <span>Thành tiền</span>
              <span>{formatVnd(total)}</span>
            </div>
          </div>
          <div className="mt-16">
            <button type="button" className="btn btn-primary btn-block btn-lg" onClick={submit}>
              {lineKeyParam ? "Cập nhật món" : "Thêm vào giỏ"}
            </button>
          </div>
          <div className="small muted mt-8" style={{ textAlign: "center" }}>
            Thay đổi được áp dụng ngay vào giỏ hàng.
          </div>
        </aside>
      </div>
    </TaskLayout>
  );
}
