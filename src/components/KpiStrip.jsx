// KPI strip (mục 7.5): dải chỉ số phẳng ngăn bằng divider,
// thay cho card. items: [{ label, value, sub }]
export default function KpiStrip({ items = [] }) {
  return (
    <div className="scms-panel d-flex flex-wrap">
      {items.map((item, idx) => (
        <div
          key={item.label}
          className="px-4 py-3"
          style={{
            minWidth: 180,
            borderLeft: idx === 0 ? "none" : "1px solid var(--line)",
          }}
        >
          <div
            className="text-muted-scms"
            style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}
          >
            {item.label}
          </div>
          <div style={{ fontSize: 24, lineHeight: "32px", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {item.value}
          </div>
          {item.sub ? <div className="small text-muted-scms">{item.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}
