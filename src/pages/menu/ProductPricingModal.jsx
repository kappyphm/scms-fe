import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Form, Modal, Spinner } from "react-bootstrap";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import StatusTag from "../../components/StatusTag.jsx";
import { useToast } from "../../components/ToastContext.jsx";
import { productsApi } from "../../api/productsApi.js";
import { toppingsApi } from "../../api/toppingsApi.js";
import { formatVnd } from "../../lib/format.js";

// FE-09 — Cấu hình giá theo size + topping áp dụng của một sản phẩm (UC11).
// Giá nằm ở size, phụ thu nằm ở topping của sản phẩm — không nằm ở sản phẩm.
// Mở modal là nạp chi tiết mới nhất từ backend (GET /products/{id}).
const SIZE_NAMES = ["S", "M", "L"];
const TOPPING_STATUS = { ACTIVE: "Đang hoạt động", INACTIVE: "Ngừng hoạt động" };

export default function ProductPricingModal({ product, onClose, onChanged }) {
  const toast = useToast();
  const [detail, setDetail] = useState(null); // bản sao làm việc của dòng sản phẩm (prop) + sizes mới nhất
  const [loading, setLoading] = useState(true);

  // size -> { input: string, error: string|null, busy: bool }
  const [sizeState, setSizeState] = useState({});
  const [sizeToDelete, setSizeToDelete] = useState(null);
  const [deletingSize, setDeletingSize] = useState(false);
  const [defaultBusy, setDefaultBusy] = useState(false);

  const [allToppings, setAllToppings] = useState([]);
  const appliedRef = useRef([]); // topping đang áp dụng mới nhất (tránh dùng prop cũ sau khi lưu)
  // toppingId -> { checked, extraPrice: string, isDefault }
  const [selection, setSelection] = useState({});
  const [toppingError, setToppingError] = useState(null);
  const [savingToppings, setSavingToppings] = useState(false);

  // KHÔNG gọi GET /products/{id}: backend hiện trả 500 ở endpoint chi tiết
  // vì ProductDetailDto luôn kèm công thức mà bảng `recipe` chưa có migration
  // tạo bảng (xem RecipeReadRepository). Dòng danh sách GET /products đã mang
  // đủ sizes/toppings/defaultSize; giá size được làm mới qua GET sizes.
  const applySizes = useCallback((sizes) => {
    setSizeState(() => {
      const next = {};
      for (const s of SIZE_NAMES) {
        const found = (sizes || []).find((x) => x.size === s);
        next[s] = { input: found ? String(found.price) : "", error: null, busy: false };
      }
      return next;
    });
  }, []);

  const applyToppings = useCallback((tops, appliedList) => {
    setSelection(() => {
      const next = {};
      for (const t of tops) {
        const applied = (appliedList || []).find((x) => x.toppingId === t.id);
        next[t.id] = applied
          ? { checked: true, extraPrice: String(applied.extraPrice), isDefault: Boolean(applied.isDefault) }
          : { checked: false, extraPrice: String(t.defaultPrice), isDefault: false };
      }
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!product) return;
    const [sizes, tops] = await Promise.all([productsApi.listSizes(product.id), toppingsApi.list()]);
    setDetail((prev) => ({ ...(prev || product), sizes }));
    setAllToppings(tops);
    if (appliedRef.current === null || appliedRef.current === undefined) appliedRef.current = [];
    applySizes(sizes);
    applyToppings(tops, appliedRef.current.length ? appliedRef.current : product.toppings);
  }, [product, applySizes, applyToppings]);

  useEffect(() => {
    if (!product) return;
    appliedRef.current = product.toppings || [];
    setLoading(true);
    refresh()
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [product, refresh, toast]);

  if (!product) return null;

  const savedPrice = (size) => {
    const found = (detail?.sizes || []).find((x) => x.size === size);
    return found ? Number(found.price) : null;
  };

  async function saveSize(size) {
    const st = sizeState[size];
    const price = Number(st?.input);
    if (st?.input === "" || Number.isNaN(price) || !Number.isInteger(price)) {
      setSizeState((p) => ({ ...p, [size]: { ...p[size], error: "Giá phải là số nguyên VND." } }));
      return;
    }
    setSizeState((p) => ({ ...p, [size]: { ...p[size], busy: true, error: null } }));
    try {
      await productsApi.upsertSize(product.id, { size, price });
      toast.success(`Đã lưu giá size ${size} cho "${product.name}".`);
      await refresh();
      onChanged?.();
    } catch (err) {
      setSizeState((p) => ({
        ...p,
        [size]: { ...p[size], busy: false, error: err.fieldError?.("price") || err.message },
      }));
    }
  }

  async function runDeleteSize() {
    if (!sizeToDelete) return;
    setDeletingSize(true);
    try {
      await productsApi.deleteSize(product.id, sizeToDelete);
      toast.success(`Đã xoá giá size ${sizeToDelete} của "${product.name}".`);
      setSizeToDelete(null);
      await refresh();
      onChanged?.();
    } catch (err) {
      // 422 DEFAULT_SIZE_IN_USE: message của backend đã nói rõ lý do chặn.
      toast.error(err.message);
      setSizeToDelete(null);
    } finally {
      setDeletingSize(false);
    }
  }

  async function setDefaultSize(size) {
    if (!detail) return;
    setDefaultBusy(true);
    try {
      const updated = await productsApi.update(product.id, {
        name: detail.name,
        categoryId: detail.categoryId,
        description: detail.description || null,
        imageUrl: detail.imageUrl || null,
        defaultSize: size,
        status: detail.status,
      });
      toast.success(`Đã đặt size ${size} làm size mặc định cho "${product.name}".`);
      setDetail((prev) => ({ ...(prev || product), defaultSize: updated.defaultSize }));
      await refresh();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDefaultBusy(false);
    }
  }

  async function saveToppings() {
    const items = [];
    for (const t of allToppings) {
      const sel = selection[t.id];
      if (!sel?.checked) continue;
      const extraPrice = Number(sel.extraPrice);
      if (sel.extraPrice === "" || Number.isNaN(extraPrice) || !Number.isInteger(extraPrice)) {
        setToppingError(`Giá cộng thêm của topping "${t.name}" phải là số nguyên VND.`);
        return;
      }
      items.push({ toppingId: t.id, extraPrice, isDefault: Boolean(sel.isDefault) });
    }
    setToppingError(null);
    setSavingToppings(true);
    try {
      const updated = await productsApi.replaceToppings(product.id, items);
      toast.success(`Đã cập nhật topping áp dụng cho "${product.name}".`);
      setDetail((prev) => ({ ...(prev || product), toppings: updated.toppings, sizes: updated.sizes }));
      appliedRef.current = updated.toppings || [];
      applySizes(updated.sizes);
      applyToppings(allToppings, updated.toppings);
      onChanged?.();
    } catch (err) {
      setToppingError(err.message);
    } finally {
      setSavingToppings(false);
    }
  }

  return (
    <>
      <Modal show onHide={onClose} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title as="h2">Giá & topping — {product.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loading || !detail ? (
            <div className="text-muted-scms">
              <Spinner size="sm" className="me-2" /> Đang tải cấu hình…
            </div>
          ) : (
            <>
              <div className="sidebar__group px-0">Giá theo size</div>
              {SIZE_NAMES.map((size) => {
                const st = sizeState[size] || { input: "", error: null, busy: false };
                const saved = savedPrice(size);
                const isDefault = detail.defaultSize === size;
                return (
                  <div key={size} className="d-flex align-items-start gap-2 mb-2">
                    <div style={{ width: 110, paddingTop: 7 }}>
                      <strong>Size {size}</strong>
                      {isDefault ? (
                        <span className="d-block">
                          <StatusTag label="Mặc định" variant="dark" />
                        </span>
                      ) : null}
                    </div>
                    <div className="flex-grow-1">
                      <Form.Control
                        type="number"
                        min="0"
                        step="500"
                        value={st.input}
                        placeholder="Chưa có giá"
                        onChange={(e) =>
                          setSizeState((p) => ({ ...p, [size]: { ...p[size], input: e.target.value, error: null } }))
                        }
                      />
                      {st.error ? (
                        <div className="field-error">{st.error}</div>
                      ) : st.input !== "" && !Number.isNaN(Number(st.input)) ? (
                        <Form.Text>{formatVnd(Number(st.input))}</Form.Text>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={st.busy || st.input === "" || Number(st.input) === saved}
                      onClick={() => saveSize(size)}
                      style={{ marginTop: 3 }}
                    >
                      {st.busy ? <Spinner size="sm" /> : saved === null ? "Thêm giá" : "Lưu giá"}
                    </Button>
                    {!isDefault && saved !== null ? (
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        disabled={defaultBusy}
                        onClick={() => setDefaultSize(size)}
                        style={{ marginTop: 3 }}
                      >
                        Đặt mặc định
                      </Button>
                    ) : null}
                    {saved !== null ? (
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => setSizeToDelete(size)}
                        style={{ marginTop: 3 }}
                      >
                        Xoá
                      </Button>
                    ) : null}
                  </div>
                );
              })}
              <p className="small text-muted-scms mb-0">
                Không xoá được giá của size đang là size mặc định — hãy đặt size khác làm mặc định trước.
              </p>

              <div className="scms-divider my-4" />

              <div className="sidebar__group px-0">Topping áp dụng</div>
              {allToppings.length === 0 ? (
                <p className="text-muted-scms mb-0">
                  Chưa có topping nào trong danh mục dùng chung. Tạo topping ở tab Topping trước.
                </p>
              ) : (
                <>
                  {allToppings.map((t) => {
                    const sel = selection[t.id] || { checked: false, extraPrice: "", isDefault: false };
                    const inactiveLocked = t.status !== "ACTIVE" && !sel.checked;
                    return (
                      <div key={t.id} className="d-flex align-items-center gap-2 mb-2">
                        <Form.Check
                          id={`top-${t.id}`}
                          checked={sel.checked}
                          disabled={inactiveLocked}
                          onChange={(e) =>
                            setSelection((p) => ({ ...p, [t.id]: { ...p[t.id], checked: e.target.checked } }))
                          }
                          label={
                            <span>
                              {t.name}{" "}
                              {t.status !== "ACTIVE" ? (
                                <StatusTag label={TOPPING_STATUS[t.status]} variant="neutral" />
                              ) : null}
                            </span>
                          }
                        />
                        <div className="flex-grow-1" />
                        <Form.Control
                          type="number"
                          min="0"
                          step="500"
                          style={{ maxWidth: 170 }}
                          value={sel.extraPrice}
                          disabled={!sel.checked}
                          onChange={(e) =>
                            setSelection((p) => ({ ...p, [t.id]: { ...p[t.id], extraPrice: e.target.value } }))
                          }
                          aria-label={`Giá cộng thêm của ${t.name}`}
                        />
                        <Form.Check
                          id={`top-def-${t.id}`}
                          type="checkbox"
                          checked={sel.isDefault}
                          disabled={!sel.checked}
                          onChange={(e) =>
                            setSelection((p) => ({ ...p, [t.id]: { ...p[t.id], isDefault: e.target.checked } }))
                          }
                          label="Chọn sẵn"
                        />
                      </div>
                    );
                  })}
                  {toppingError ? <div className="field-error">{toppingError}</div> : null}
                  <div className="d-flex justify-content-end mt-3">
                    <Button variant="primary" onClick={saveToppings} disabled={savingToppings}>
                      {savingToppings ? <Spinner size="sm" className="me-2" /> : null}
                      Lưu topping áp dụng
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </Modal.Body>
      </Modal>

      <ConfirmDialog
        show={Boolean(sizeToDelete)}
        title="Xoá giá size"
        body={
          <p className="mb-0">
            Xoá giá size <strong>{sizeToDelete}</strong> của sản phẩm <strong>{product.name}</strong>?
          </p>
        }
        confirmLabel="Xoá giá"
        danger
        busy={deletingSize}
        onCancel={() => setSizeToDelete(null)}
        onConfirm={runDeleteSize}
      />
    </>
  );
}
