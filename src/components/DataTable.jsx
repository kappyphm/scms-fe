import { Pagination, Spinner, Table } from "react-bootstrap";

// Bảng dữ liệu chuẩn (mục 7.3): header nhãn uppercase, số căn phải dạng
// tabular, có trạng thái loading/rỗng và phân trang khớp PageResponse
// của backend (page đánh số từ 1 ở phía FE cho thân thiện với người dùng,
// tầng API chịu trách nhiệm đổi sang page index của backend khi cần).
//
// columns: [{ key, header, render(row), numeric, width }]
// pagination: { page, totalPages, onChange(nextPage) } (page bắt đầu từ 1)
export default function DataTable({ columns, rows, rowKey, loading = false, emptyMessage = "Không có dữ liệu.", pagination = null }) {
  return (
    <div className="scms-panel">
      <div className="table-responsive">
        <Table hover>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.numeric ? "num" : undefined} style={c.width ? { width: c.width } : undefined}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-4">
                  <Spinner size="sm" className="me-2" /> Đang tải…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-4 text-muted-scms">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((c) => (
                    <td key={c.key} className={c.numeric ? "num" : undefined}>
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
      {pagination && pagination.totalPages > 1 ? (
        <div className="d-flex justify-content-end px-3 py-2" style={{ borderTop: "1px solid var(--line)" }}>
          <Pagination size="sm">
            <Pagination.Prev
              disabled={pagination.page <= 1}
              onClick={() => pagination.onChange(pagination.page - 1)}
            />
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
              <Pagination.Item key={p} active={p === pagination.page} onClick={() => pagination.onChange(p)}>
                {p}
              </Pagination.Item>
            ))}
            <Pagination.Next
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pagination.onChange(pagination.page + 1)}
            />
          </Pagination>
        </div>
      ) : null}
    </div>
  );
}
