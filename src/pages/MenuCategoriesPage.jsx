import { useCallback, useEffect, useState } from "react";
import { Button, Form, Modal, Spinner } from "react-bootstrap";
import AdminLayout from "../layouts/AdminLayout.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import DataTable from "../components/DataTable.jsx";
import FormField from "../components/FormField.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SessionHeaderRight from "../components/SessionHeader.jsx";
import StatusTag from "../components/StatusTag.jsx";
import { useToast } from "../components/ToastContext.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { buildMenu } from "../config/menu.js";
import { categoriesApi } from "../api/categoriesApi.js";
import { formatDateTime } from "../lib/format.js";

// SCR-11 TAB-05 (phần danh mục) — Quản lý danh mục menu (UC09).
const STATUS_LABELS = { ACTIVE: "Đang hoạt động", INACTIVE: "Ngừng hoạt động" };
const PAGE_SIZE = 10;

const emptyForm = { name: "", description: "", sortOrder: 1, status: "ACTIVE" };

export default function MenuCategoriesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const menu = buildMenu(user);

  const [page, setPage] = useState({ items: [], uiPage: 1, totalPages: 0, totalItems: 0 });
  const [uiPage, setUiPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState(null); // { kind: 'status'|'soft'|'hard', row }
  const [busyAction, setBusyAction] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await categoriesApi.list({
        uiPage,
        size: PAGE_SIZE,
        keyword: keyword || undefined,
        status: statusFilter || undefined,
      });
      setPage(result);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [uiPage, keyword, statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, sortOrder: page.totalItems + 1 });
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({ name: row.name, description: row.description || "", sortOrder: row.sortOrder, status: row.status });
    setFormError(null);
    setFormOpen(true);
  }

  async function submitForm(e) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      sortOrder: Number(form.sortOrder),
      status: form.status,
    };
    try {
      if (editing) {
        await categoriesApi.update(editing.id, payload);
        toast.success(`Đã cập nhật danh mục "${payload.name}".`);
      } else {
        await categoriesApi.create(payload);
        toast.success(`Đã tạo danh mục "${payload.name}".`);
      }
      setFormOpen(false);
      load();
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  }

  async function move(row, direction) {
    try {
      const all = await categoriesApi.listAll();
      const idx = all.findIndex((c) => c.id === row.id);
      const swapIdx = idx + direction;
      if (idx < 0 || swapIdx < 0 || swapIdx >= all.length) return;
      const reordered = [...all];
      [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
      await categoriesApi.reorder(reordered.map((c, i) => ({ categoryId: c.id, sortOrder: i + 1 })));
      toast.success("Đã cập nhật thứ tự hiển thị.");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function runConfirm() {
    if (!confirm) return;
    setBusyAction(true);
    const row = confirm.row;
    try {
      if (confirm.kind === "status") {
        const next = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
        await categoriesApi.changeStatus(row.id, next);
        toast.success(`Đã đổi trạng thái danh mục "${row.name}" sang ${STATUS_LABELS[next]}.`);
      } else if (confirm.kind === "soft") {
        await categoriesApi.softDelete(row.id);
        toast.success(`Đã xoá mềm danh mục "${row.name}" (chuyển sang Ngừng hoạt động).`);
      } else if (confirm.kind === "hard") {
        await categoriesApi.hardDelete(row.id);
        toast.success(`Đã xóa vĩnh viễn danh mục "${row.name}".`);
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
    { key: "sortOrder", header: "Thứ tự", numeric: true, width: 80 },
    { key: "code", header: "Mã", width: 110 },
    { key: "name", header: "Tên danh mục" },
    {
      key: "description",
      header: "Mô tả",
      render: (r) => <span className="text-muted-scms">{r.description || "—"}</span>,
    },
    { key: "productCount", header: "Số sản phẩm", numeric: true },
    {
      key: "status",
      header: "Trạng thái",
      render: (r) => <StatusTag status={r.status} label={STATUS_LABELS[r.status]} />,
    },
    { key: "updatedAt", header: "Cập nhật", render: (r) => formatDateTime(r.updatedAt) },
    {
      key: "actions",
      header: "",
      width: 300,
      render: (r) => (
        <div className="d-flex gap-1 justify-content-end">
          <Button size="sm" variant="outline-secondary" title="Lên" onClick={() => move(r, -1)}>
            ↑
          </Button>
          <Button size="sm" variant="outline-secondary" title="Xuống" onClick={() => move(r, 1)}>
            ↓
          </Button>
          <Button size="sm" variant="outline-secondary" onClick={() => openEdit(r)}>
            Sửa
          </Button>
          <Button size="sm" variant="outline-secondary" onClick={() => setConfirm({ kind: "status", row: r })}>
            {r.status === "ACTIVE" ? "Ngừng" : "Kích hoạt"}
          </Button>
          <Button size="sm" variant="outline-secondary" onClick={() => setConfirm({ kind: "soft", row: r })}>
            Xóa
          </Button>
          <Button size="sm" variant="danger" onClick={() => setConfirm({ kind: "hard", row: r })}>
            Xóa hẳn
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout menu={menu} branchName={user?.branchName || undefined} headerRight={<SessionHeaderRight />} screenCode="SCR-11">
      <PageHeader
        title="Danh mục menu"
        screenCode="SCR-11 · TAB-05"
        description="Danh mục sản phẩm của toàn chuỗi. Thứ tự hiển thị áp dụng cho menu bán hàng."
        actions={
          <Button className="btn-accent" onClick={openCreate}>
            + Thêm danh mục
          </Button>
        }
      />

      <div className="d-flex gap-2 mb-3">
        <Form.Control
          type="search"
          placeholder="Tìm theo mã hoặc tên danh mục…"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setUiPage(1);
          }}
          style={{ maxWidth: 320 }}
        />
        <Form.Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setUiPage(1);
          }}
          style={{ maxWidth: 200 }}
        >
          <option value="">Mọi trạng thái</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="INACTIVE">Ngừng hoạt động</option>
        </Form.Select>
      </div>

      <DataTable
        columns={columns}
        rows={page.items}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage="Chưa có danh mục nào."
        pagination={{ page: uiPage, totalPages: page.totalPages, onChange: setUiPage }}
      />

      <Modal show={formOpen} onHide={() => !saving && setFormOpen(false)} centered>
        <Form onSubmit={submitForm}>
          <Modal.Header closeButton={!saving}>
            <Modal.Title as="h2">{editing ? "Sửa danh mục" : "Thêm danh mục"}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {editing ? (
              <p className="small text-muted-scms">
                Mã danh mục: <span className="mono">{editing.code}</span> (không thay đổi được)
              </p>
            ) : null}
            <FormField label="Tên danh mục" required error={formError?.fieldError?.("name") || null}>
              <Form.Control
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Cà phê"
                autoFocus
              />
            </FormField>
            <FormField label="Mô tả" error={formError?.fieldError?.("description") || null}>
              <Form.Control
                as="textarea"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </FormField>
            <div className="d-flex gap-3">
              <FormField label="Thứ tự hiển thị" required error={formError?.fieldError?.("sortOrder") || null} className="mb-3 flex-grow-1">
                <Form.Control
                  type="number"
                  min={1}
                  max={9999}
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                />
              </FormField>
              <FormField label="Trạng thái" className="mb-3 flex-grow-1">
                <Form.Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="ACTIVE">Đang hoạt động</option>
                  <option value="INACTIVE">Ngừng hoạt động</option>
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
            <Button type="submit" variant="primary" disabled={saving || !form.name.trim()}>
              {saving ? <Spinner size="sm" className="me-2" /> : null}
              {editing ? "Lưu thay đổi" : "Tạo danh mục"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ConfirmDialog
        show={Boolean(confirm)}
        title={
          confirm?.kind === "status"
            ? "Đổi trạng thái danh mục"
            : confirm?.kind === "hard"
              ? "Xóa vĩnh viễn danh mục"
              : "Xoá mềm danh mục"
        }
        body={
          confirm ? (
            <>
              {confirm.kind === "status" ? (
                <p className="mb-0">
                  Đổi trạng thái danh mục <strong>{confirm.row.name}</strong> sang{" "}
                  {confirm.row.status === "ACTIVE" ? "Ngừng hoạt động" : "Đang hoạt động"}?
                </p>
              ) : confirm.kind === "hard" ? (
                <p className="mb-0">
                  Xóa vĩnh viễn danh mục <strong>{confirm.row.name}</strong>? Hành động này không thể
                  hoàn tác và sẽ bị chặn nếu danh mục còn sản phẩm đang bán.
                </p>
              ) : (
                <p className="mb-0">
                  Xoá mềm danh mục <strong>{confirm.row.name}</strong>? Backend thực hiện xoá mềm bằng
                  cách chuyển danh mục sang trạng thái Ngừng hoạt động; sản phẩm thuộc danh mục không
                  bị xoá và không bị chuyển đi.
                </p>
              )}
            </>
          ) : null
        }
        confirmLabel={confirm?.kind === "hard" ? "Xóa vĩnh viễn" : "Xác nhận"}
        danger={confirm?.kind === "hard"}
        busy={busyAction}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </AdminLayout>
  );
}
