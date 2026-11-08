// Tiêu đề màn hình: H1 + mô tả + hành động ở góc phải.
// FE-29 (chỉ đạo 2026-11-09): KHÔNG hiển thị mã màn hình (SCR/POP/TAB)
// ở bất kỳ đâu trên giao diện — prop screenCode được giữ để tương thích
// các trang đang truyền vào nhưng không còn được render.
export default function PageHeader({ title, description = null, actions = null }) {
  return (
    <div className="page-head">
      <div className="page-head__main">
        <h1>{title}</h1>
        {description ? <p className="page-sub">{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}
