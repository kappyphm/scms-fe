import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useRouter } from "../router/HashRouter.jsx";
import { shiftsApi, SHIFT_TYPE_LABELS, SHIFT_STATUS, CASH_TXN_LABELS } from "../api/shiftsApi.js";
import { branchesApi } from "../api/branchesApi.js";
import { usersApi } from "../api/usersApi.js";
import { formatVnd, formatDate, formatDateTime } from "../lib/format.js";

// Màn hình Ca & két tiền (UC08, UC24-UC27): mở ca với tiền đầu ca, theo dõi
// két theo thời gian thực (doanh thu tiền mặt từ POS tự cộng vào két), nạp /
// rút tiền có PIN quản lý duyệt, đóng ca đối chiếu số đếm thực tế, và phân
// ca theo tuần. GET /shifts/current trả 422 khi chưa mở ca — đó là trạng
// thái "chưa mở ca" của màn hình, không phải lỗi.

function weekRange() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // thứ 2 = 0
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(monday), to: iso(sunday) };
}

export default function ShiftPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { navigate } = useRouter();
  const isCoo = user?.role === "COO";

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(user?.branchId || null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [noShift, setNoShift] = useState(false);

  const [openForm, setOpenForm] = useState({ openingCash: "", note: "" });
  const [opening, setOpening] = useState(false);

  const [cashModal, setCashModal] = useState(null); // "in" | "out"
  const [cashForm, setCashForm] = useState({ amount: "", reason: "", managerPin: "" });
  const [cashSaving, setCashSaving] = useState(false);

  const [closeForm, setCloseForm] = useState({ countedCash: "", discrepancyReason: "" });
  const [closing, setClosing] = useState(false);

  const [schedules, setSchedules] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [schedForm, setSchedForm] = useState({
    shiftDate: new Date().toISOString().slice(0, 10),
    shiftType: "MORNING",
    start: "06:00",
    end: "14:00",
    employeeIds: [],
  });
  const [schedSaving, setSchedSaving] = useState(false);
  const week = useMemo(weekRange, []);

  const loadSummary = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const data = await shiftsApi.current(branchId);
      setSummary(data);
      setNoShift(false);
    } catch (err) {
      if (err.status === 422) {
        setSummary(null);
        setNoShift(true);
      } else {
        toast.error(err.message || "Không tải được thông tin ca.");
      }
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
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!branchId) return;
    shiftsApi
      .listSchedules(branchId, week.from, week.to)
      .then(setSchedules)
      .catch(() => setSchedules([]));
    usersApi
      .list({ uiPage: 1, size: 100, branchId, status: "ACTIVE" })
      .then((page) => setEmployees(page.items))
      .catch(() => setEmployees([]));
  }, [branchId, week]);

  const shift = summary?.shift;

  async function handleOpen(e) {
    e.preventDefault();
    setOpening(true);
    try {
      await shiftsApi.open({
        branchId,
        openingCash: Number(openForm.openingCash || 0),
        note: openForm.note || undefined,
      });
      toast.success("Đã mở ca. Két tiền sẵn sàng giao dịch.");
      setOpenForm({ openingCash: "", note: "" });
      loadSummary();
    } catch (err) {
      toast.error(err.message || "Không mở được ca.");
    } finally {
      setOpening(false);
    }
  }

  async function handleCash(e) {
    e?.preventDefault();
    if (!shift) return;
    setCashSaving(true);
    try {
      const body = { amount: Number(cashForm.amount), reason: cashForm.reason, managerPin: cashForm.managerPin };
      if (cashModal === "in") await shiftsApi.cashIn(shift.id, body);
      else await shiftsApi.cashOut(shift.id, body);
      toast.success(cashModal === "in" ? "Đã nạp tiền vào két." : "Đã rút tiền khỏi két.");
      setCashModal(null);
      setCashForm({ amount: "", reason: "", managerPin: "" });
      loadSummary();
    } catch (err) {
      toast.error(err.message || "Không thực hiện được giao dịch két.");
    } finally {
      setCashSaving(false);
    }
  }

  const expected = summary ? Number(summary.currentCashBalance || 0) : 0;
  const counted = closeForm.countedCash === "" ? null : Number(closeForm.countedCash);
  const variance = counted === null ? 0 : counted - expected;

  async function handleClose(e) {
    e.preventDefault();
    if (!shift) return;
    if (variance !== 0 && !closeForm.discrepancyReason.trim()) {
      toast.error("Số đếm lệch với sổ két — cần nhập lý do giải trình.");
      return;
    }
    setClosing(true);
    try {
      const closed = await shiftsApi.close(shift.id, {
        countedCash: counted,
        discrepancyReason: variance !== 0 ? closeForm.discrepancyReason : undefined,
      });
      toast.success(
        Number(closed.variance || 0) === 0
          ? "Đã đóng ca. Số tiền khớp với sổ két."
          : `Đã đóng ca. Chênh lệch ${formatVnd(closed.variance)} đã ghi nhận kèm giải trình.`,
      );
      setCloseForm({ countedCash: "", discrepancyReason: "" });
      loadSummary();
    } catch (err) {
      toast.error(err.message || "Không đóng được ca.");
    } finally {
      setClosing(false);
    }
  }

  async function handleSchedule(e) {
    e.preventDefault();
    setSchedSaving(true);
    try {
      await shiftsApi.createSchedule({
        branchId,
        shiftDate: schedForm.shiftDate,
        shiftType: schedForm.shiftType,
        plannedStart: new Date(`${schedForm.shiftDate}T${schedForm.start}:00`).toISOString(),
        plannedEnd: new Date(`${schedForm.shiftDate}T${schedForm.end}:00`).toISOString(),
        employeeIds: schedForm.employeeIds,
      });
      toast.success("Đã lên lịch ca.");
      const list = await shiftsApi.listSchedules(branchId, week.from, week.to);
      setSchedules(list);
    } catch (err) {
      toast.error(err.message || "Không lên được lịch ca.");
    } finally {
      setSchedSaving(false);
    }
  }

  function toggleEmployee(id) {
    setSchedForm((f) => ({
      ...f,
      employeeIds: f.employeeIds.includes(id)
        ? f.employeeIds.filter((x) => x !== id)
        : [...f.employeeIds, id],
    }));
  }

  const txnColumns = [
    { key: "type", header: "Loại giao dịch", render: (r) => CASH_TXN_LABELS[r.type] || r.type },
    { key: "amount", header: "Số tiền", render: (r) => <span className="mono">{formatVnd(r.amount)}</span> },
    { key: "reason", header: "Lý do", render: (r) => r.reason || "—" },
    { key: "createdAt", header: "Thời gian", render: (r) => formatDateTime(r.createdAt) },
  ];

  const schedColumns = [
    { key: "shiftDate", header: "Ngày", render: (r) => formatDate(r.shiftDate) },
    { key: "shiftType", header: "Ca", render: (r) => SHIFT_TYPE_LABELS[r.shiftType] || r.shiftType },
    {
      key: "planned",
      header: "Giờ dự kiến",
      render: (r) =>
        `${new Date(r.plannedStart).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} – ${new Date(r.plannedEnd).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`,
    },
    { key: "totalEmployees", header: "Nhân viên", render: (r) => `${r.totalEmployees} người` },
    {
      key: "status",
      header: "Trạng thái",
      render: (r) => {
        const s = SHIFT_STATUS[r.status] || { label: r.status, variant: "muted" };
        return <StatusTag variant={s.variant}>{s.label}</StatusTag>;
      },
    },
  ];

  return (
    <AdminLayout
      menu={buildMenu(user)}
      branchName={user?.branchName || undefined}
      headerRight={<SessionHeaderRight />}
      userName={user?.fullName}
      userRole={roleLabel(user?.role)}
    >
      <PageHeader
        title="Ca & két tiền"
        screenCode="UC08 · UC24–UC27"
        description="Mở ca, theo dõi két tiền mặt theo thời gian thực và đóng ca đối chiếu cuối ca."
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

      {loading ? (
        <div className="scms-panel p-4 text-muted-scms">
          <Spinner size="sm" className="me-2" /> Đang tải thông tin ca…
        </div>
      ) : noShift ? (
        <Row>
          <Col lg={6}>
            <div className="scms-panel">
              <div className="panel-head">
                <h3>Mở ca làm việc</h3>
              </div>
              <Form onSubmit={handleOpen} className="p-4">
                <p className="text-muted-scms mb-3">
                  Chi nhánh chưa có ca đang mở. Mở ca với số tiền mặt đang có trong két để bắt đầu
                  bán hàng và hoàn tiền từ két.
                </p>
                <FormField label="Tiền mặt đầu ca (VNĐ)" required>
                  <Form.Control
                    type="number"
                    min="0"
                    step="1000"
                    value={openForm.openingCash}
                    onChange={(e) => setOpenForm({ ...openForm, openingCash: e.target.value })}
                    placeholder="Ví dụ 500000"
                    required
                  />
                </FormField>
                <FormField label="Ghi chú">
                  <Form.Control
                    value={openForm.note}
                    onChange={(e) => setOpenForm({ ...openForm, note: e.target.value })}
                    placeholder="Không bắt buộc"
                  />
                </FormField>
                <div className="form-actions">
                  <Button type="submit" className="btn-accent" disabled={opening}>
                    {opening ? <Spinner size="sm" /> : "Mở ca"}
                  </Button>
                </div>
              </Form>
            </div>
          </Col>
        </Row>
      ) : summary ? (
        <>
          <Row className="g-4 mb-4">
            <Col lg={5}>
              <div className="scms-panel h-100">
                <div className="panel-head">
                  <h3>Két tiền hiện tại</h3>
                  <StatusTag variant="success">Đang mở ca</StatusTag>
                </div>
                <div className="p-4">
                  {[
                    ["Loại ca", SHIFT_TYPE_LABELS[shift?.shiftType] || shift?.shiftType || "—"],
                    ["Mở lúc", formatDateTime(shift?.openedAt)],
                    ["Tiền đầu ca", formatVnd(summary.openingCash)],
                    ["Doanh thu tiền mặt (POS)", formatVnd(summary.cashRevenue)],
                    ["Doanh thu chuyển khoản / QR", formatVnd(summary.transferRevenue)],
                    ["Đã nạp thêm", formatVnd(summary.totalCashIn)],
                    ["Đã rút ra", formatVnd(summary.totalCashOut)],
                    ["Đã hoàn cho khách", formatVnd(summary.totalRefundOut)],
                  ].map(([k, v]) => (
                    <div key={k} className="stat-line">
                      <span>{k}</span>
                      <strong className="mono">{v}</strong>
                    </div>
                  ))}
                  <div className="stat-line" style={{ borderTop: "2px solid var(--line)", marginTop: 8, paddingTop: 10 }}>
                    <span>Số dư két dự kiến</span>
                    <strong className="mono" style={{ fontSize: 17 }}>{formatVnd(summary.currentCashBalance)}</strong>
                  </div>
                  <div className="d-flex gap-2 mt-3">
                    <Button className="btn-accent" onClick={() => setCashModal("in")}>Nạp tiền</Button>
                    <Button variant="outline-secondary" onClick={() => setCashModal("out")}>Rút tiền</Button>
                    <Button variant="link" className="text-muted-scms" onClick={() => navigate("/pos")}>Tới POS</Button>
                  </div>
                </div>
              </div>
            </Col>
            <Col lg={7}>
              <DataTable
                title="Giao dịch trong ca"
                columns={txnColumns}
                rows={summary.transactions || []}
                rowKey={(r) => r.id}
                emptyMessage="Chưa có giao dịch két nào trong ca."
              />
            </Col>
          </Row>

          <Row>
            <Col lg={5}>
              <div className="scms-panel">
                <div className="panel-head">
                  <h3>Đóng ca</h3>
                </div>
                <Form onSubmit={handleClose} className="p-4">
                  <FormField label="Tiền mặt đếm thực tế (VNĐ)" required>
                    <Form.Control
                      type="number"
                      min="0"
                      step="1000"
                      value={closeForm.countedCash}
                      onChange={(e) => setCloseForm({ ...closeForm, countedCash: e.target.value })}
                      placeholder={`Dự kiến ${formatVnd(expected)}`}
                      required
                    />
                  </FormField>
                  {counted !== null && variance !== 0 && (
                    <>
                      <div className="notice notice-warning mb-3">
                        Chênh lệch {formatVnd(variance)} so với sổ két. Theo quy định đối chiếu ca,
                        cần nhập lý do giải trình để đóng ca.
                      </div>
                      <FormField label="Lý do giải trình" required>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={closeForm.discrepancyReason}
                          onChange={(e) => setCloseForm({ ...closeForm, discrepancyReason: e.target.value })}
                          required
                        />
                      </FormField>
                    </>
                  )}
                  <div className="form-actions">
                    <Button type="submit" variant="danger" disabled={closing}>
                      {closing ? <Spinner size="sm" /> : "Đóng ca & chốt két"}
                    </Button>
                  </div>
                </Form>
              </div>
            </Col>
          </Row>
        </>
      ) : null}

      <Row className="mt-4">
        <Col lg={7}>
          <DataTable
            title={`Lịch phân ca tuần này (${formatDate(week.from)} – ${formatDate(week.to)})`}
            columns={schedColumns}
            rows={schedules}
            rowKey={(r) => r.shiftId}
            emptyMessage="Chưa có lịch ca nào trong tuần."
          />
        </Col>
        <Col lg={5}>
          <div className="scms-panel">
            <div className="panel-head">
              <h3>Lên lịch ca mới</h3>
            </div>
            <Form onSubmit={handleSchedule} className="p-4">
              <div className="form-grid">
                <FormField label="Ngày làm việc" required>
                  <Form.Control
                    type="date"
                    value={schedForm.shiftDate}
                    onChange={(e) => setSchedForm({ ...schedForm, shiftDate: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Loại ca" required>
                  <Form.Select
                    value={schedForm.shiftType}
                    onChange={(e) => setSchedForm({ ...schedForm, shiftType: e.target.value })}
                  >
                    {Object.entries(SHIFT_TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </Form.Select>
                </FormField>
                <FormField label="Giờ bắt đầu" required>
                  <Form.Control type="time" value={schedForm.start} onChange={(e) => setSchedForm({ ...schedForm, start: e.target.value })} required />
                </FormField>
                <FormField label="Giờ kết thúc" required>
                  <Form.Control type="time" value={schedForm.end} onChange={(e) => setSchedForm({ ...schedForm, end: e.target.value })} required />
                </FormField>
              </div>
              <FormField label="Nhân viên trong ca">
                <div>
                  {employees.length === 0 ? (
                    <span className="text-muted-scms">Chưa có nhân viên đang hoạt động ở chi nhánh.</span>
                  ) : (
                    employees.map((emp) => (
                      <Form.Check
                        key={emp.id}
                        id={`sched-emp-${emp.id}`}
                        className="check-row"
                        label={`${emp.fullName} — ${emp.position}`}
                        checked={schedForm.employeeIds.includes(emp.id)}
                        onChange={() => toggleEmployee(emp.id)}
                      />
                    ))
                  )}
                </div>
              </FormField>
              <div className="form-actions">
                <Button type="submit" className="btn-accent" disabled={schedSaving}>
                  {schedSaving ? <Spinner size="sm" /> : "Lên lịch ca"}
                </Button>
              </div>
            </Form>
          </div>
        </Col>
      </Row>

      <Modal show={cashModal !== null} onHide={() => setCashModal(null)} centered>
        <Form onSubmit={handleCash}>
          <Modal.Header closeButton>
            <Modal.Title>{cashModal === "in" ? "Nạp tiền vào két" : "Rút tiền khỏi két"}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <FormField label="Số tiền (VNĐ)" required>
              <Form.Control type="number" min="1" step="1000" value={cashForm.amount} onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })} required />
            </FormField>
            <FormField label="Lý do" required>
              <Form.Control value={cashForm.reason} onChange={(e) => setCashForm({ ...cashForm, reason: e.target.value })} required />
            </FormField>
            <FormField label="PIN của quản lý chi nhánh" required hint="Giao dịch tiền mặt trong ca cần quản lý xác nhận bằng PIN.">
              <Form.Control type="password" inputMode="numeric" autoComplete="off" value={cashForm.managerPin} onChange={(e) => setCashForm({ ...cashForm, managerPin: e.target.value })} required />
            </FormField>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setCashModal(null)}>Hủy</Button>
            <Button type="button" className="btn-accent" disabled={cashSaving} onClick={handleCash}>
              {cashSaving ? <Spinner size="sm" /> : "Xác nhận"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </AdminLayout>
  );
}
