// Tag trạng thái (tài liệu thiết kế mục 7.4): trạng thái không chỉ dựa vào
// màu — luôn có nhãn chữ. Dạng phẳng, radius 4px, viền 1px.
const VARIANTS = {
  success: { background: "var(--success-soft)", color: "var(--success)", border: "var(--success)" },
  warn: { background: "var(--warn-soft)", color: "var(--accent-dark)", border: "var(--accent)" },
  neutral: { background: "var(--paper-2)", color: "var(--ink-2)", border: "var(--line-strong)" },
  dark: { background: "var(--ink)", color: "var(--paper)", border: "var(--ink)" },
};

// Ánh xạ trạng thái nghiệp vụ thường gặp -> variant.
const STATUS_VARIANTS = {
  ACTIVE: "success",
  AVAILABLE: "success",
  CHECKED_IN: "success",
  COMPLETED: "success",
  INACTIVE: "neutral",
  UNAVAILABLE: "warn",
  DRAFT: "warn",
  EXPIRED: "dark",
};

export default function StatusTag({ status, label, variant }) {
  const v = VARIANTS[variant || STATUS_VARIANTS[status] || "neutral"];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 8px",
        borderRadius: "var(--radius-xs)",
        border: `1px solid ${v.border}`,
        background: v.background,
        color: v.color,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {label || status}
    </span>
  );
}
