import { useEffect, useState } from "react";
import { Button, Col, Form, Row, Spinner } from "react-bootstrap";
import AdminLayout from "../layouts/AdminLayout.jsx";
import PageHeader from "../components/PageHeader.jsx";
import FormField from "../components/FormField.jsx";
import SessionHeaderRight from "../components/SessionHeader.jsx";
import { useToast } from "../components/ToastContext.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { roleLabel } from "../auth/landing.js";
import { buildMenu } from "../config/menu.js";
import { syncApi } from "../api/syncApi.js";
import { branchesApi } from "../api/branchesApi.js";
import { formatDateTime } from "../lib/format.js";

// Trang Đồng bộ chuỗi (UC14, chỉ COO): chọn nhóm cấu hình (danh mục, món,
// voucher) và các chi nhánh đích để đẩy cấu hình cấp chuỗi xuống chi nhánh.
export default function SyncSettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ syncCategories: true, syncProducts: true, syncVouchers: true });
  const [targets, setTargets] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    branchesApi
      .list({ uiPage: 1, size: 100 })
      .then((page) => setBranches(page.items.filter((b) => b.status !== "INACTIVE")))
      .catch((err) => toast.error(err.message || "Không tải được danh sách chi nhánh."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTarget(id) {
    setTargets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSync(e) {
    e.preventDefault();
    if (targets.length === 0) {
      toast.error("Chọn ít nhất một chi nhánh đích.");
      return;
    }
    setSyncing(true);
    try {
      const res = await syncApi.syncToBranches({ ...form, targetBranchIds: targets });
      setResult(res);
      toast.success(res.message || "Đã đồng bộ cấu hình chuỗi.");
    } catch (err) {
      toast.error(err.message || "Không đồng bộ được cấu hình.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <AdminLayout
      menu={buildMenu(user)}
      branchName={user?.branchName || undefined}
      headerRight={<SessionHeaderRight />}
      userName={user?.fullName}
      userRole={roleLabel(user?.role)}
    >
      <PageHeader
        title="Đồng bộ chuỗi"
        screenCode="UC14"
        description="Đẩy cấu hình cấp chuỗi — danh mục, món và voucher — xuống các chi nhánh được chọn."
      />
      <Row>
        <Col lg={7}>
          <div className="scms-panel">
            <div className="panel-head">
              <h3>Cấu hình đồng bộ</h3>
            </div>
            <Form onSubmit={handleSync} className="p-4">
              <FormField label="Nhóm cấu hình">
                <div>
                  <Form.Check id="sync-cat" className="check-row" label="Danh mục món" checked={form.syncCategories} onChange={(e) => setForm({ ...form, syncCategories: e.target.checked })} />
                  <Form.Check id="sync-prod" className="check-row" label="Món và bảng giá" checked={form.syncProducts} onChange={(e) => setForm({ ...form, syncProducts: e.target.checked })} />
                  <Form.Check id="sync-vou" className="check-row" label="Voucher khuyến mãi" checked={form.syncVouchers} onChange={(e) => setForm({ ...form, syncVouchers: e.target.checked })} />
                </div>
              </FormField>
              <FormField label="Chi nhánh đích" required>
                <div>
                  {branches.length === 0 ? (
                    <span className="text-muted-scms">Chưa có chi nhánh đang hoạt động.</span>
                  ) : (
                    branches.map((b) => (
                      <Form.Check
                        key={b.id}
                        id={`sync-branch-${b.id}`}
                        className="check-row"
                        label={`${b.code} — ${b.name}`}
                        checked={targets.includes(b.id)}
                        onChange={() => toggleTarget(b.id)}
                      />
                    ))
                  )}
                </div>
              </FormField>
              <div className="form-actions">
                <Button type="submit" className="btn-accent" disabled={syncing}>
                  {syncing ? <Spinner size="sm" /> : "Đồng bộ ngay"}
                </Button>
              </div>
            </Form>
          </div>
        </Col>
        <Col lg={5}>
          <div className="scms-panel">
            <div className="panel-head">
              <h3>Kết quả gần nhất</h3>
            </div>
            <div className="p-4">
              {result ? (
                <>
                  <div className="stat-line"><span>Trạng thái</span><strong>{result.success ? "Thành công" : "Chưa thành công"}</strong></div>
                  <div className="stat-line"><span>Chi nhánh đã nhận</span><strong>{(result.syncedBranchIds || []).join(", ") || "—"}</strong></div>
                  <div className="stat-line"><span>Thời điểm</span><strong>{formatDateTime(result.syncedAt)}</strong></div>
                  {result.message ? <p className="text-muted-scms mt-3 mb-0">{result.message}</p> : null}
                </>
              ) : (
                <p className="text-muted-scms mb-0">Chưa có lượt đồng bộ nào trong phiên này.</p>
              )}
            </div>
          </div>
        </Col>
      </Row>
    </AdminLayout>
  );
}
