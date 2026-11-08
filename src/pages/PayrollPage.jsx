import { useCallback, useEffect, useState } from "react";
import { Button, Col, Form, Modal, Row, Spinner } from "react-bootstrap";
import AdminLayout from "../layouts/AdminLayout.jsx";
import PageHeader from "../components/PageHeader.jsx";
import FormField from "../components/FormField.jsx";
import DataTable from "../components/DataTable.jsx";
import StatusTag from "../components/StatusTag.jsx";
import SessionHeaderRight from "../components/SessionHeader.jsx";
import { useToast } from "../components/ToastContext.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { roleLabel } from "../auth/landing.js";
import { buildMenu } from "../config/menu.js";
import { payrollApi, PAY_PERIOD_STATUS } from "../api/payrollApi.js";
import { branchesApi } from "../api/branchesApi.js";
import { formatVnd, formatDate, formatDateTime } from "../lib/format.js";

// Màn hình Bảng lương (UC45): lập kỳ lương theo chi nhánh — hệ thống tự
// tính dòng lương từ chấm công hoàn tất trong kỳ; quản lý chỉnh thưởng /
// khấu trừ khi kỳ còn nháp, gửi duyệt; COO duyệt hoặc trả lại kèm lý do.
export default function PayrollPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isCoo = user?.role === "COO";

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(user?.branchId || null);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [createForm, setCreateForm] = useState({ periodName: "", startDate: "", endDate: "" });
  const [creating, setCreating] = useState(false);

  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({ bonus: "", deduction: "", note: "" });
  const [editSaving, setEditSaving] = useState(false);

  const [acting, setActing] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const loadPeriods = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const list = await payrollApi.listPeriods(branchId);
      setPeriods(list);
    } catch (err) {
      toast.error(err.message || "Không tải được danh sách kỳ lương.");
    } finally {
      setLoading(false);
    }
  }, [branchId, toast]);

  useEffect(() => {
    if (!isCoo) return;
    branchesApi
      .list({ uiPage: 1, size: 100 })
      .then((page) => {
        setBranches(page.items);
        if (!branchId && page.items.length > 0) setBranchId(page.items[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCoo]);

  useEffect(() => {
    setSelected(null);
    setItems([]);
    loadPeriods();
  }, [loadPeriods]);

  async function selectPeriod(period) {
    setSelected(period);
    setItemsLoading(true);
    try {
      setItems(await payrollApi.listItems(period.id));
    } catch (err) {
      toast.error(err.message || "Không tải được dòng lương.");
    } finally {
      setItemsLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    try {
      const period = await payrollApi.createPeriod({
        branchId,
        periodName: createForm.periodName.trim(),
        startDate: createForm.startDate,
        endDate: createForm.endDate,
      });
      toast.success(`Đã lập kỳ lương với ${period.totalEmployees} nhân viên.`);
      setCreateForm({ periodName: "", startDate: "", endDate: "" });
      await loadPeriods();
      selectPeriod(period);
    } catch (err) {
      toast.error(err.message || "Không lập được kỳ lương.");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(item) {
    setEditItem(item);
    setEditForm({
      bonus: String(item.bonus ?? 0),
      deduction: String(item.deductions ?? 0),
      note: item.note || "",
    });
  }

  async function handleEdit(e) {
    e.preventDefault();
    setEditSaving(true);
    try {
      const updated = await payrollApi.updateItem(editItem.id, {
        bonus: Number(editForm.bonus || 0),
        deduction: Number(editForm.deduction || 0),
        note: editForm.note || undefined,
      });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      toast.success("Đã cập nhật dòng lương.");
      setEditItem(null);
    } catch (err) {
      toast.error(err.message || "Không cập nhật được dòng lương.");
    } finally {
      setEditSaving(false);
    }
  }

  async function refreshSelected() {
    const list = await payrollApi.listPeriods(branchId);
    setPeriods(list);
    const fresh = list.find((p) => p.id === selected?.id);
    if (fresh) setSelected(fresh);
  }

  async function handleSubmit() {
    setActing(true);
    try {
      await payrollApi.submit(selected.id);
      toast.success("Đã gửi kỳ lương chờ COO duyệt.");
      await refreshSelected();
    } catch (err) {
      toast.error(err.message || "Không gửi duyệt được.");
    } finally {
      setActing(false);
    }
  }

  async function handleApprove() {
    setActing(true);
    try {
      await payrollApi.approve(selected.id);
      toast.success("Đã duyệt kỳ lương.");
      await refreshSelected();
    } catch (err) {
      toast.error(err.message || "Không duyệt được kỳ lương.");
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error("Cần nhập lý do trả lại.");
      return;
    }
    setActing(true);
    try {
      await payrollApi.reject(selected.id, rejectReason.trim());
      toast.success("Đã trả lại kỳ lương để điều chỉnh.");
      setShowReject(false);
      setRejectReason("");
      await refreshSelected();
    } catch (err) {
      toast.error(err.message || "Không trả lại được kỳ lương.");
    } finally {
      setActing(false);
    }
  }

  const periodColumns = [
    { key: "periodName", header: "Kỳ lương", render: (r) => r.periodName },
    { key: "range", header: "Khoảng ngày", render: (r) => `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` },
    { key: "totalEmployees", header: "Nhân viên", render: (r) => `${r.totalEmployees} người` },
    { key: "totalAmount", header: "Tổng chi", render: (r) => <span className="mono">{formatVnd(r.totalAmount)}</span> },
    {
      key: "status",
      header: "Trạng thái",
      render: (r) => {
        const s = PAY_PERIOD_STATUS[r.status] || { label: r.status, variant: "neutral" };
        return <StatusTag variant={s.variant}>{s.label}</StatusTag>;
      },
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <Button size="sm" variant="outline-secondary" onClick={() => selectPeriod(r)}>
          Xem dòng lương
        </Button>
      ),
    },
  ];

  const editable = selected?.status === "DRAFT";
  const itemColumns = [
    { key: "employeeName", header: "Nhân viên", render: (r) => r.employeeName },
    { key: "position", header: "Vị trí", render: (r) => r.position },
    { key: "totalHours", header: "Giờ công", render: (r) => `${Number(r.totalHours || 0)} giờ` },
    { key: "hourlyRate", header: "Đơn giá giờ", render: (r) => <span className="mono">{formatVnd(r.hourlyRate)}</span> },
    { key: "baseSalary", header: "Lương theo giờ", render: (r) => <span className="mono">{formatVnd(r.baseSalary)}</span> },
    { key: "allowance", header: "Phụ cấp", render: (r) => <span className="mono">{formatVnd(r.allowance)}</span> },
    { key: "bonus", header: "Thưởng", render: (r) => <span className="mono">{formatVnd(r.bonus)}</span> },
    { key: "deductions", header: "Khấu trừ", render: (r) => <span className="mono">{formatVnd(r.deductions)}</span> },
    { key: "totalAmount", header: "Thực nhận", render: (r) => <strong className="mono">{formatVnd(r.totalAmount)}</strong> },
    ...(editable
      ? [
          {
            key: "edit",
            header: "",
            render: (r) => (
              <Button size="sm" variant="outline-secondary" onClick={() => openEdit(r)}>
                Chỉnh thưởng / khấu trừ
              </Button>
            ),
          },
        ]
      : []),
  ];

  const selectedMeta = selected ? PAY_PERIOD_STATUS[selected.status] || { label: selected.status, variant: "neutral" } : null;

  return (
    <AdminLayout
      menu={buildMenu(user)}
      branchName={user?.branchName || undefined}
      headerRight={<SessionHeaderRight />}
      userName={user?.fullName}
      userRole={roleLabel(user?.role)}
    >
      <PageHeader
        title="Bảng lương"
        screenCode="UC45"
        description="Lập kỳ lương từ chấm công, chỉnh thưởng và khấu trừ, gửi duyệt và phê duyệt chi trả."
      />

      {isCoo && (
        <div className="scms-panel p-3 mb-4" style={{ maxWidth: 420 }}>
          <FormField label="Chi nhánh">
            <Form.Select value={branchId || ""} onChange={(e) => setBranchId(Number(e.target.value))}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </Form.Select>
          </FormField>
        </div>
      )}

      <Row className="g-4">
        <Col lg={7}>
          {loading ? (
            <div className="scms-panel p-4 text-muted-scms">
              <Spinner size="sm" className="me-2" /> Đang tải kỳ lương…
            </div>
          ) : (
            <DataTable
              title="Các kỳ lương"
              columns={periodColumns}
              rows={periods}
              rowKey={(r) => r.id}
              emptyMessage="Chưa có kỳ lương nào cho chi nhánh."
            />
          )}
        </Col>
        <Col lg={5}>
          <div className="scms-panel">
            <div className="panel-head">
              <h3>Lập kỳ lương mới</h3>
            </div>
            <Form onSubmit={handleCreate} className="p-4">
              <FormField label="Tên kỳ lương" required>
                <Form.Control
                  value={createForm.periodName}
                  onChange={(e) => setCreateForm({ ...createForm, periodName: e.target.value })}
                  placeholder="Ví dụ: Tuần 2 tháng 11/2026"
                  required
                />
              </FormField>
              <div className="form-grid">
                <FormField label="Từ ngày" required>
                  <Form.Control type="date" value={createForm.startDate} onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })} required />
                </FormField>
                <FormField label="Đến ngày" required>
                  <Form.Control type="date" value={createForm.endDate} onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })} required />
                </FormField>
              </div>
              <p className="text-muted-scms mb-3">
                Hệ thống tự lập dòng lương cho mọi nhân viên của chi nhánh từ các ca chấm công đã
                hoàn tất trong khoảng ngày đã chọn.
              </p>
              <div className="form-actions">
                <Button type="submit" className="btn-accent" disabled={creating}>
                  {creating ? <Spinner size="sm" /> : "Lập kỳ lương"}
                </Button>
              </div>
            </Form>
          </div>
        </Col>
      </Row>

      {selected && (
        <div className="mt-4">
          <div className="scms-panel mb-4">
            <div className="panel-head">
              <h3>{selected.periodName}</h3>
              <StatusTag variant={selectedMeta.variant}>{selectedMeta.label}</StatusTag>
            </div>
            <div className="p-4">
              <Row>
                <Col md={3}><div className="stat-line"><span>Khoảng ngày</span><strong>{formatDate(selected.startDate)} – {formatDate(selected.endDate)}</strong></div></Col>
                <Col md={3}><div className="stat-line"><span>Nhân viên</span><strong>{selected.totalEmployees} người</strong></div></Col>
                <Col md={3}><div className="stat-line"><span>Tổng chi</span><strong className="mono">{formatVnd(selected.totalAmount)}</strong></div></Col>
                <Col md={3}><div className="stat-line"><span>Lập lúc</span><strong>{formatDateTime(selected.createdAt)}</strong></div></Col>
              </Row>
              {selected.rejectionReason ? (
                <div className="notice notice-warning mt-3">Lý do bị trả lại: {selected.rejectionReason}</div>
              ) : null}
              <div className="d-flex gap-2 mt-3">
                {selected.status === "DRAFT" && (
                  <Button className="btn-accent" disabled={acting} onClick={handleSubmit}>
                    {acting ? <Spinner size="sm" /> : "Gửi duyệt"}
                  </Button>
                )}
                {selected.status === "SUBMITTED" && isCoo && (
                  <>
                    <Button className="btn-accent" disabled={acting} onClick={handleApprove}>
                      {acting ? <Spinner size="sm" /> : "Duyệt kỳ lương"}
                    </Button>
                    <Button variant="outline-danger" disabled={acting} onClick={() => setShowReject(true)}>
                      Trả lại để điều chỉnh
                    </Button>
                  </>
                )}
                {selected.status === "SUBMITTED" && !isCoo && (
                  <span className="text-muted-scms">Kỳ lương đang chờ COO duyệt.</span>
                )}
                {selected.status === "APPROVED" && (
                  <span className="text-muted-scms">Kỳ lương đã được duyệt{selected.approvedAt ? ` lúc ${formatDateTime(selected.approvedAt)}` : ""}.</span>
                )}
              </div>
            </div>
          </div>

          {itemsLoading ? (
            <div className="scms-panel p-4 text-muted-scms">
              <Spinner size="sm" className="me-2" /> Đang tải dòng lương…
            </div>
          ) : (
            <DataTable
              title="Dòng lương"
              columns={itemColumns}
              rows={items}
              rowKey={(r) => r.id}
              emptyMessage="Kỳ lương chưa có dòng lương nào."
            />
          )}
        </div>
      )}

      <Modal show={editItem !== null} onHide={() => setEditItem(null)} centered>
        <Form onSubmit={handleEdit}>
          <Modal.Header closeButton>
            <Modal.Title>Chỉnh dòng lương — {editItem?.employeeName}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <FormField label="Tiền thưởng (VNĐ)" required>
              <Form.Control type="number" min="0" step="1000" value={editForm.bonus} onChange={(e) => setEditForm({ ...editForm, bonus: e.target.value })} required />
            </FormField>
            <FormField label="Tiền khấu trừ (VNĐ)" required>
              <Form.Control type="number" min="0" step="1000" value={editForm.deduction} onChange={(e) => setEditForm({ ...editForm, deduction: e.target.value })} required />
            </FormField>
            <FormField label="Ghi chú">
              <Form.Control value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} />
            </FormField>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setEditItem(null)}>Hủy</Button>
            <Button type="button" className="btn-accent" disabled={editSaving} onClick={handleEdit}>
              {editSaving ? <Spinner size="sm" /> : "Lưu thay đổi"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showReject} onHide={() => setShowReject(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Trả lại kỳ lương</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <FormField label="Lý do trả lại" required>
            <Form.Control as="textarea" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} required />
          </FormField>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowReject(false)}>Hủy</Button>
          <Button variant="danger" disabled={acting} onClick={handleReject}>
            {acting ? <Spinner size="sm" /> : "Trả lại"}
          </Button>
        </Modal.Footer>
      </Modal>
    </AdminLayout>
  );
}
