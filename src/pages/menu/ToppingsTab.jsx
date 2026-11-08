import { useCallback, useEffect, useState } from "react";
import { Button, Form, Modal, Spinner } from "react-bootstrap";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import DataTable from "../../components/DataTable.jsx";
import FormField from "../../components/FormField.jsx";
import StatusTag from "../../components/StatusTag.jsx";
import { useToast } from "../../components/ToastContext.jsx";
import { toppingsApi } from "../../api/toppingsApi.js";
import { formatVnd } from "../../lib/format.js";

// Tab Topping dùng chung trong màn hình Menu & BOM (SCR-11 TAB-05) — UC11.
// Danh sách backend trả toàn bộ (không phân trang). Xoá mềm = INACTIVE;
// kích hoạt lại đi qua cập nhật (PUT mang theo status) vì backend không
// có PATCH status cho topping.
const STATUS_LABELS = { ACTIVE: "Đang hoạt động", INACTIVE: "Ngừng hoạt động" };

const emptyForm = { name: "", defaultPrice: "", status: "ACTIVE" };

export default function ToppingsTab() {
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState(null); // { kind: 'soft'|'hard'|'activate', row }
  const [busyAction, setBusyAction] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await toppingsApi.list());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({ name: row.name, defaultPrice: String(row.defaultPrice), status: row.status });
    setFormError(null);
    setFormOpen(true);
  }

  async function submitForm(e) {
    e.preventDefault();
    const price = Number(form.defaultPrice);
    if (form.defaultPrice === "" || Number.isNaN(price) || !Number.isInteger(price)) {
      setFormError({ fieldError: (f) => (f === "defaultPrice" ? "Giá phải là số nguyên VND." : null), fieldErrors: [{ field: "defaultPrice" }] });
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = { name: form.name.trim(), defaultPrice: price, status: form.status };
    try {
      if (editing) {
        await toppingsApi.update(editing.id, payload);
        toast.success(`Đã cập nhật topping "${payload.name}".`);
      } else {
        await toppingsApi.create(payload);
        toast.success(`Đã tạo topping "${payload.name}".`);
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
        await toppingsApi.softDelete(confirm.row.id);
        toast.success(`Đã ngừng hoạt động topping "${confirm.row.name}" (xoá mềm).`);
      } else if (confirm.kind === "activate") {
        await toppingsApi.update(confirm.row.id, {
          name: confirm.row.name,
          defaultPrice: Number(confirm.row.defaultPrice),
          status: "ACTIVE",
        });
        toast.success(`Đã kích hoạt lại topping "${confirm.row.name}".`);
      } else {
        await toppingsApi.hardDelete(confirm.row.id);
        toast.success(`Đã xóa vĩnh viễn topping "${confirm.row.name}".`);
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
    { key: "name", header: "Tên topping" },
    {
      key: "defaultPrice",
      header: "Giá mặc định",
      numeric: true,
      render: (r) => formatVnd(Number(r.defaultPrice)),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (r) => <StatusTag label={STATUS_LABELS[r.status]} status={r.status} />,
    },
    {
      key: "actions",
      header: "",
      width: 230,
      render: (r) => (
        <div className="d-flex gap-1 justify-content-end">
          <Button size="sm" variant="outline-secondary" onClick={() => openEdit(r)}>
            Sửa
          </Button>
          {r.status === "ACTIVE" ? (
            <Button size="sm" variant="outline-secondary" onClick={() => setConfirm({ kind: "soft", row: r })}>
              Ngừng
            </Button>
          ) : (
            <Button size="sm" variant="outline-secondary" onClick={() => setConfirm({ kind: "activate", row: r })}>
              Kích hoạt
            </Button>
          )}
          <Button size="sm" variant="outline-secondary" onClick={() => setConfirm({ kind: "hard", row: r })}>
            Xóa hẳn
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="d-flex gap-2 mb-3">
        <div className="flex-grow-1" />
        <Button variant="primary" onClick={openCreate}>
          + Thêm topping
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage="Chưa có topping nào."
      />

      <Modal show={formOpen} onHide={() => !saving && setFormOpen(false)} centered>
        <Form onSubmit={submitForm}>
          <Modal.Header closeButton={!saving}>
            <Modal.Title as="h2">{editing ? "Sửa topping" : "Thêm topping"}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <FormField label="Tên topping" required error={formError?.fieldError?.("name") || null}>
              <Form.Control
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Kem tươi"
                autoFocus
              />
            </FormField>
            <FormField
              label="Giá mặc định (VNĐ)"
              required
              error={formError?.fieldError?.("defaultPrice") || null}
              help="Giá cộng thêm mặc định khi topping được gắn vào sản phẩm; từng sản phẩm có thể đặt lại giá riêng."
            >
              <Form.Control
                type="number"
                min="0"
                step="500"
                value={form.defaultPrice}
                onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })}
                placeholder="Ví dụ: 8000"
              />
            </FormField>
            <FormField label="Trạng thái">
              <Form.Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Ngừng hoạt động</option>
              </Form.Select>
            </FormField>
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
              {editing ? "Lưu thay đổi" : "Tạo topping"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ConfirmDialog
        show={Boolean(confirm)}
        title={
          confirm?.kind === "hard"
            ? "Xóa vĩnh viễn topping"
            : confirm?.kind === "activate"
              ? "Kích hoạt lại topping"
              : "Xoá mềm topping"
        }
        body={
          confirm ? (
            confirm.kind === "hard" ? (
              <p className="mb-0">
                Xóa vĩnh viễn topping <strong>{confirm.row.name}</strong>? Topping sẽ bị gỡ khỏi mọi sản
                phẩm đang áp dụng. Hành động này không thể hoàn tác.
              </p>
            ) : confirm.kind === "activate" ? (
              <p className="mb-0">
                Kích hoạt lại topping <strong>{confirm.row.name}</strong> để áp dụng cho sản phẩm?
              </p>
            ) : (
              <p className="mb-0">
                Xoá mềm topping <strong>{confirm.row.name}</strong>? Topping chuyển sang trạng thái Ngừng
                hoạt động và không còn hiện trên POS.
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
