import { useCallback, useEffect, useState } from "react";
import { Button, Col, Form, Row, Spinner } from "react-bootstrap";
import AdminLayout from "../layouts/AdminLayout.jsx";
import PageHeader from "../components/PageHeader.jsx";
import FormField from "../components/FormField.jsx";
import KpiStrip from "../components/KpiStrip.jsx";
import DataTable from "../components/DataTable.jsx";
import StatusTag from "../components/StatusTag.jsx";
import SessionHeaderRight from "../components/SessionHeader.jsx";
import Icon from "../components/Icon.jsx";
import { RouteLink, useRouter } from "../router/HashRouter.jsx";
import { useToast } from "../components/ToastContext.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { roleLabel } from "../auth/landing.js";
import { buildMenu } from "../config/menu.js";
import { ordersApi } from "../api/ordersApi.js";
import { inventoryApi } from "../api/inventoryApi.js";
import { shiftsApi } from "../api/shiftsApi.js";
import { branchesApi } from "../api/branchesApi.js";
import { ORDER_STATUS_META } from "./OrdersPage.jsx";
import { formatVnd, formatDateTime } from "../lib/format.js";

// Các trang tổng quan (SCR-07 / SCR-10) dùng số liệu THẬT từ các API đã có:
// đơn hàng trong ngày (đếm + doanh thu theo trạng thái đã thu tiền), đơn
// chờ thanh toán, nguyên liệu sắp hết và trạng thái ca/két hiện tại.
// Backend chưa có API báo cáo tổng hợp (UC34-UC42) nên số liệu được cộng
// từ danh sách đơn trong ngày — đủ cho quy mô một chi nhánh trong ngày.

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { fromDate: start.toISOString(), toDate: now.toISOString() };
}

async function fetchTodayOrders(branchId) {
  const { fromDate, toDate } = todayRange();
  let items = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= 3) {
    const res = await ordersApi.list({ branchId, fromDate, toDate, page, size: 100 });
    items = items.concat(res.content || []);
    totalPages = res.totalPages || 1;
    page += 1;
  }
  return items;
}

function summarize(orders) {
  const paid = orders.filter((o) => o.status === "PAID" || o.status === "PARTIALLY_REFUNDED");
  return {
    count: orders.length,
    revenue: paid.reduce((s, o) => s + Number(o.finalAmount || 0), 0),
    pending: orders.filter((o) => o.status === "PENDING").length,
  };
}

function Shell({ user, title, screenCode, description, children }) {
  return (
    <AdminLayout
      menu={buildMenu(user)}
      branchName={user?.branchName || undefined}
      headerRight={<SessionHeaderRight />}
      userName={user?.fullName}
      userRole={roleLabel(user?.role)}
    >
      <PageHeader title={title} screenCode={screenCode} description={description} />
      {children}
    </AdminLayout>
  );
}

export function BranchOverviewPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { navigate } = useRouter();
  const isCoo = user?.role === "COO";
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(user?.branchId || null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [lowStock, setLowStock] = useState(0);
  const [shift, setShift] = useState(undefined); // undefined = đang tải, null = chưa mở ca

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

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const orders = await fetchTodayOrders(branchId);
      setStats(summarize(orders));
      setRecent([...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5));
    } catch (err) {
      toast.error(err.message || "Không tải được số liệu hôm nay.");
    } finally {
      setLoading(false);
    }
    inventoryApi
      .getLowStock(branchId)
      .then((list) => setLowStock(Array.isArray(list) ? list.length : 0))
      .catch(() => setLowStock(0));
    shiftsApi
      .current(branchId)
      .then((s) => setShift(s))
      .catch(() => setShift(null));
  }, [branchId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const recentColumns = [
    {
      key: "receiptNo",
      header: "Số hóa đơn",
      render: (r) => (
        <a
          href={`#/branch/orders/detail?id=${r.id}`}
          onClick={(e) => {
            e.preventDefault();
            navigate(`/branch/orders/detail?id=${r.id}`);
          }}
          className="mono fw-semibold text-decoration-none"
        >
          {r.receiptNo || `#${r.id}`}
        </a>
      ),
    },
    { key: "createdAt", header: "Thời gian", render: (r) => formatDateTime(r.createdAt) },
    { key: "finalAmount", header: "Tổng tiền", render: (r) => <span className="mono">{formatVnd(r.finalAmount)}</span> },
    {
      key: "status",
      header: "Trạng thái",
      render: (r) => {
        const m = ORDER_STATUS_META[r.status] || { label: r.status, variant: "neutral" };
        return <StatusTag variant={m.variant}>{m.label}</StatusTag>;
      },
    },
  ];

  return (
    <Shell
      user={user}
      title="Tổng quan chi nhánh"
      screenCode="SCR-07"
      description={`Xin chào ${user?.fullName || ""}. Số liệu vận hành hôm nay của chi nhánh.`}
    >
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

      {loading || !stats ? (
        <div className="scms-panel p-4 text-muted-scms mb-4">
          <Spinner size="sm" className="me-2" /> Đang tải số liệu hôm nay…
        </div>
      ) : (
        <div className="mb-4">
          <KpiStrip
            items={[
              { label: "Đơn hôm nay", value: String(stats.count) },
              { label: "Doanh thu đã thu", value: formatVnd(stats.revenue) },
              { label: "Đơn chờ thanh toán", value: String(stats.pending) },
              { label: "Nguyên liệu sắp hết", value: String(lowStock) },
            ]}
          />
        </div>
      )}

      <Row className="g-4 mb-4">
        <Col lg={4}>
          <div className="scms-panel h-100">
            <div className="panel-head">
              <h3>Ca & két tiền</h3>
            </div>
            <div className="p-4">
              {shift === undefined ? (
                <span className="text-muted-scms">Đang kiểm tra ca hiện tại…</span>
              ) : shift === null ? (
                <>
                  <p className="mb-3">Chi nhánh chưa mở ca. Mở ca để bắt đầu bán hàng và hoàn tiền từ két.</p>
                  <Button className="btn-accent" onClick={() => navigate("/branch/shift")}>Tới trang Ca & két tiền</Button>
                </>
              ) : (
                <>
                  <div className="stat-line"><span>Trạng thái</span><StatusTag variant="success">Đang mở ca</StatusTag></div>
                  <div className="stat-line"><span>Số dư két dự kiến</span><strong className="mono">{formatVnd(shift.currentCashBalance)}</strong></div>
                  <div className="stat-line"><span>Doanh thu tiền mặt</span><strong className="mono">{formatVnd(shift.cashRevenue)}</strong></div>
                  <Button variant="outline-secondary" className="mt-3" onClick={() => navigate("/branch/shift")}>Quản lý ca & két</Button>
                </>
              )}
            </div>
          </div>
        </Col>
        <Col lg={8}>
          <DataTable
            title="Đơn mới nhất hôm nay"
            columns={recentColumns}
            rows={recent}
            rowKey={(r) => r.id}
            emptyMessage="Hôm nay chưa có đơn nào."
          />
        </Col>
      </Row>

    </Shell>
  );
}

export function ChainOverviewPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const page = await branchesApi.list({ uiPage: 1, size: 100 });
        const active = page.items.filter((b) => b.status !== "INACTIVE");
        const results = [];
        for (const b of active) {
          const orders = await fetchTodayOrders(b.id).catch(() => []);
          const s = summarize(orders);
          const low = await inventoryApi
            .getLowStock(b.id)
            .then((list) => (Array.isArray(list) ? list.length : 0))
            .catch(() => 0);
          const shiftOpen = await shiftsApi
            .current(b.id)
            .then(() => true)
            .catch(() => false);
          results.push({ branch: b, ...s, lowStock: low, shiftOpen });
        }
        setRows(results);
        setTotals({
          count: results.reduce((s, r) => s + r.count, 0),
          revenue: results.reduce((s, r) => s + r.revenue, 0),
          pending: results.reduce((s, r) => s + r.pending, 0),
          lowStock: results.reduce((s, r) => s + r.lowStock, 0),
        });
      } catch (err) {
        toast.error(err.message || "Không tải được tổng quan chuỗi.");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const columns = [
    { key: "branch", header: "Chi nhánh", render: (r) => `${r.branch.code} — ${r.branch.name}` },
    { key: "count", header: "Đơn hôm nay", render: (r) => String(r.count) },
    { key: "revenue", header: "Doanh thu đã thu", render: (r) => <span className="mono">{formatVnd(r.revenue)}</span> },
    { key: "pending", header: "Chờ thanh toán", render: (r) => String(r.pending) },
    { key: "lowStock", header: "Sắp hết hàng", render: (r) => String(r.lowStock) },
    {
      key: "shiftOpen",
      header: "Ca hiện tại",
      render: (r) => (r.shiftOpen ? <StatusTag variant="success">Đang mở</StatusTag> : <StatusTag variant="neutral">Chưa mở</StatusTag>),
    },
  ];

  return (
    <Shell
      user={user}
      title="Tổng quan chuỗi"
      screenCode="SCR-10"
      description={`Xin chào ${user?.fullName || ""}. Số liệu vận hành hôm nay của toàn chuỗi.`}
    >
      {loading || !totals ? (
        <div className="scms-panel p-4 text-muted-scms mb-4">
          <Spinner size="sm" className="me-2" /> Đang tổng hợp số liệu các chi nhánh…
        </div>
      ) : (
        <>
          <div className="mb-4">
            <KpiStrip
              items={[
                { label: "Đơn hôm nay (toàn chuỗi)", value: String(totals.count) },
                { label: "Doanh thu đã thu", value: formatVnd(totals.revenue) },
                { label: "Đơn chờ thanh toán", value: String(totals.pending) },
                { label: "Nguyên liệu sắp hết", value: String(totals.lowStock) },
              ]}
            />
          </div>
          <div className="mb-4">
            <DataTable
              title="Theo chi nhánh"
              columns={columns}
              rows={rows}
              rowKey={(r) => r.branch.id}
              emptyMessage="Chưa có chi nhánh đang hoạt động."
            />
          </div>
        </>
      )}
    </Shell>
  );
}
