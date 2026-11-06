// Tiêu đề màn hình: H1 + mã màn hình (đối chiếu tài liệu) + mô tả + hành động.
export default function PageHeader({ title, screenCode = null, description = null, actions = null }) {
  return (
    <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
      <div>
        <div className="d-flex align-items-baseline gap-3">
          <h1 className="mb-0">{title}</h1>
          {screenCode ? <span className="screen-code">{screenCode}</span> : null}
        </div>
        {description ? <p className="text-muted-scms mt-1 mb-0">{description}</p> : null}
      </div>
      {actions ? <div className="d-flex gap-2 flex-none">{actions}</div> : null}
    </div>
  );
}
