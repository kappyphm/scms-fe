import { useCallback, useEffect, useState } from "react";
import { Button, Form, Modal, Spinner } from "react-bootstrap";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import DataTable from "../../components/DataTable.jsx";
import FormField from "../../components/FormField.jsx";
import StatusTag from "../../components/StatusTag.jsx";
import { useToast } from "../../components/ToastContext.jsx";
import { categoriesApi } from "../../api/categoriesApi.js";
import { productsApi } from "../../api/productsApi.js";
import ProductPricingModal from "./ProductPricingModal.jsx";
import { formatDateTime, formatVnd } from "../../lib/format.js";

// Tab Sản phẩm trong màn hình Menu & sản phẩm (SCR-11 TAB-05) — UC10.
// Cố ý chưa có ô tìm kiếm theo tên: backend lỗi 500 khi nhận param keyword
// ở GET /products; chỉ bật lại khi backend đã sửa (xem productsApi.js).
const STATUS_LABELS = { AVAILABLE: "Đang bán", UNAVAILABLE: "Tạm hết", INACTIVE: "Ngừng bán" };
const STATUS_VARIANTS = { AVAILABLE: "dark", UNAVAILABLE: "warn", INACTIVE: "neutral" };
const PAGE_SIZE = 10;

const emptyForm = { name: "", categoryId: "", description: "", imageUrl: "", defaultSize: "", status: "AVAILABLE" };

function priceSummary(row) {
  const prices = (row.sizes || []).map((s) => Number(s.price)).filter((n) => !Number.isNaN(n));
  if (prices.length === 0) return "Chưa cấu hình giá";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatVnd(min) : `${formatVnd(min)} – ${formatVnd(max)}`;
}

export default function ProductsTab() {
  const toast = useToast();

  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState({ items: [], totalPages: 0, totalItems: 0 });
  const [uiPage, setUiPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState(null); // { kind: 'soft'|'hard', row }
  const [pricingProduct, setPricingProduct] = useState(null); // FE-09: modal giá & topping
  const [busyAction, setBusyAction] = useState(false);

  useEffect(() => {
    categoriesApi
      .listAll()
      .then(setCategories)
      .catch((err) => toast.error(err.message));
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await productsApi.list({
        uiPage,
        size: PAGE_SIZE,
        categoryId: categoryFilter ? Number(categoryFilter) : undefined,
        status: statusFilter || undefined,
      });
      setPage(result);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [uiPage, categoryFilter, statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, categoryId: categories[0]?.id ? String(categories[0].id) : "" });
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      name: row.name,
      categoryId: String(row.categoryId),
      description: row.description || "",
      imageUrl: row.imageUrl || "",
      defaultSize: row.defaultSize || "",
      status: row.status,
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function submitForm(e) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const payload = {
      name: form.name.trim(),
      categoryId: Number(form.categoryId),
      description: form.description.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
      defaultSize: form.defaultSize || null,
      status: form.status,
    };
    try {
      if (editing) {
        await productsApi.update(editing.id, payload);
        toast.success(`Đã cập nhật sản phẩm "${payload.name}".`);
      } else {
        await productsApi.create(payload);
        toast.success(`Đã tạo sản phẩm "${payload.name}".`);
      }
      setFormOpen(false);
      load();
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  }

  async function runConfirm() {
    if (!confirm) return;
    setBusyAction(true);
    try {
      if (confirm.kind === "soft") {
        await productsApi.softDelete(confirm.row.id);
        toast.success(`Đã ngừng bán sản phẩm "${confirm.row.name}" (xoá mềm).`);
      } else {
        await productsApi.hardDelete(confirm.row.id);
        toast.success(`Đã xóa vĩnh viễn sản phẩm "${confirm.row.name}".`);
      }
      setConfirm(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyAction(false);
    }
  }

  const columns = [
    { key: "name", header: "Tên sản phẩm" },
    { key: "categoryName", header: "Danh mục", render: (r) => r.categoryName || "—" },
    { key: "defaultSize", header: "Size mặc định", render: (r) => r.defaultSize || "—" },
    { key: "price", header: "Giá bán", numeric: true, render: (r) => priceSummary(r) },
    {
      key: "toppings",
      header: "Topping",
      render: (r) =>
        (r.toppings || []).length
          ? (r.toppings || []).map((t) => t.name).join(", ")
          : "—",
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (r) => <StatusTag label={STATUS_LABELS[r.status]} variant={STATUS_VARIANTS[r.status]} />,
    },
    { key: "updatedAt", header: "Cập nhật", render: (r) => formatDateTime(r.updatedAt) },
    {
      key: "actions",
      header: "",
      width: 300,
      render: (r) => (
        <div className="d-flex gap-1 justify-content-end">
          <Button size="sm" variant="outline-secondary" onClick={() => setPricingProduct(r)}>
            Giá & topping
          </Button>
          <Button size="sm" variant="outline-secondary" onClick={() => openEdit(r)}>
            Sửa
          </Button>
          <Button size="sm" variant="outline-secondary" onClick={() => setConfirm({ kind: "soft", row: r })}>
            Xóa
          </Button>
          <Button size="sm" variant="outline-secondary" onClick={() => setConfirm({ kind: "hard", row: r })}>
            Xóa hẳn
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={page.items}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage="Chưa có sản phẩm nào."
        pagination={{ page: uiPage, totalPages: page.totalPages, onChange: setUiPage }}
        toolbar={
          <>
            <Form.Select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setUiPage(1);
              }}
              style={{ maxWidth: 240 }}
              aria-label="Lọc theo danh mục"
            >
              <option value="">Mọi danh mục</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Form.Select>
            <Form.Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setUiPage(1);
              }}
              style={{ maxWidth: 200 }}
              aria-label="Lọc theo trạng thái"
            >
              <option value="">Mọi trạng thái</option>
              <option value="AVAILABLE">Đang bán</option>
              <option value="UNAVAILABLE">Tạm hết</option>
              <option value="INACTIVE">Ngừng bán</option>
            </Form.Select>
            <div className="flex-grow-1" />
            <Button variant="primary" onClick={openCreate}>
              Thêm sản phẩm
            </Button>
          </>
        }
      />

      <Modal show={formOpen} onHide={() => !saving && setFormOpen(false)} centered>
        <Form onSubmit={submitForm}>
          <Modal.Header closeButton={!saving}>
            <Modal.Title as="h2">{editing ? "Sửa sản phẩm" : "Thêm sản phẩm"}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <FormField label="Tên sản phẩm" required error={formError?.fieldError?.("name") || null}>
              <Form.Control
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Cà phê sữa đá"
                autoFocus
              />
            </FormField>
            <FormField label="Danh mục" required error={formError?.fieldError?.("categoryId") || null}>
              <Form.Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">— Chọn danh mục —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Form.Select>
            </FormField>
            <FormField label="Mô tả" error={formError?.fieldError?.("description") || null}>
              <Form.Control
                as="textarea"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </FormField>
            <FormField label="Đường dẫn ảnh" error={formError?.fieldError?.("imageUrl") || null}>
              <Form.Control
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://…"
              />
            </FormField>
            <div className="d-flex gap-3">
              <FormField label="Size mặc định" className="mb-3 flex-grow-1">
                <Form.Select value={form.defaultSize} onChange={(e) => setForm({ ...form, defaultSize: e.target.value })}>
                  <option value="">Chưa chọn</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                </Form.Select>
              </FormField>
              <FormField label="Trạng thái" className="mb-3 flex-grow-1">
                <Form.Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="AVAILABLE">Đang bán</option>
                  <option value="UNAVAILABLE">Tạm hết</option>
                  <option value="INACTIVE">Ngừng bán</option>
                </Form.Select>
              </FormField>
            </div>
            {formError && !formError.fieldErrors?.length ? (
              <p className="small mb-0" style={{ fontWeight: 600 }}>
                {formError.message}
              </p>
            ) : null}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" disabled={saving || !form.name.trim() || !form.categoryId}>
              {saving ? <Spinner size="sm" className="me-2" /> : null}
              {editing ? "Lưu thay đổi" : "Tạo sản phẩm"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {pricingProduct ? (
        <ProductPricingModal
          product={pricingProduct}
          onClose={() => setPricingProduct(null)}
          onChanged={load}
        />
      ) : null}

      <ConfirmDialog
        show={Boolean(confirm)}
        title={confirm?.kind === "hard" ? "Xóa vĩnh viễn sản phẩm" : "Xoá mềm sản phẩm"}
        body={
          confirm ? (
            confirm.kind === "hard" ? (
              <p className="mb-0">
                Xóa vĩnh viễn sản phẩm <strong>{confirm.row.name}</strong>? Hành động này không thể hoàn
                tác và sẽ bị chặn nếu sản phẩm đang được gắn với voucher.
              </p>
            ) : (
              <p className="mb-0">
                Xoá mềm sản phẩm <strong>{confirm.row.name}</strong>? Sản phẩm chuyển sang trạng thái
                Ngừng bán và không còn xuất hiện ở menu bán hàng.
              </p>
            )
          ) : null
        }
        confirmLabel={confirm?.kind === "hard" ? "Xóa vĩnh viễn" : "Xác nhận"}
        danger={confirm?.kind === "hard"}
        busy={busyAction}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </>
  );
}
