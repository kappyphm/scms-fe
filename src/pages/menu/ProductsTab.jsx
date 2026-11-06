import { useCallback, useEffect, useState } from "react";
import { Button, Form } from "react-bootstrap";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusTag from "../../components/StatusTag.jsx";
import { useToast } from "../../components/ToastContext.jsx";
import { useRouter } from "../../router/HashRouter.jsx";
import { categoriesApi } from "../../api/categoriesApi.js";
import { productsApi } from "../../api/productsApi.js";
import { formatDateTime, formatVnd } from "../../lib/format.js";

// Tab Sản phẩm trong màn hình Menu & BOM (SCR-11 TAB-05) — UC10/UC11.
// Thêm/Sửa sản phẩm là task screen /chain/menu/edit(?id=) mô phỏng
// menuEdit của prototype (thông tin + giá theo size + topping trong
// cùng một form); tab này chỉ còn danh sách + xoá mềm/xoá hẳn.
// Cố ý chưa có ô tìm kiếm theo tên: backend lỗi 500 khi nhận param
// keyword ở GET /products; chỉ bật lại khi backend đã sửa.
const STATUS_LABELS = { AVAILABLE: "Đang bán", UNAVAILABLE: "Tạm hết", INACTIVE: "Ngừng bán" };
const STATUS_VARIANTS = { AVAILABLE: "dark", UNAVAILABLE: "warn", INACTIVE: "neutral" };
const PAGE_SIZE = 10;

function priceSummary(row) {
  const prices = (row.sizes || []).map((s) => Number(s.price)).filter((n) => !Number.isNaN(n));
  if (prices.length === 0) return "Chưa cấu hình giá";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatVnd(min) : `${formatVnd(min)} – ${formatVnd(max)}`;
}

export default function ProductsTab() {
  const toast = useToast();
  const { navigate } = useRouter();

  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState({ items: [], totalPages: 0, totalItems: 0 });
  const [uiPage, setUiPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [confirm, setConfirm] = useState(null); // { kind: 'soft'|'hard', row }
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
        (r.toppings || []).length ? (r.toppings || []).map((t) => t.name).join(", ") : "—",
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
      width: 210,
      render: (r) => (
        <div className="d-flex gap-1 justify-content-end">
          <Button size="sm" variant="outline-secondary" onClick={() => navigate(`/chain/menu/edit?id=${r.id}`)}>
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
            <Button variant="primary" onClick={() => navigate("/chain/menu/edit")}>
              Thêm sản phẩm
            </Button>
          </>
        }
      />

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
