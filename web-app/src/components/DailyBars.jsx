// Grafica de barras con el promedio diario de una sola metrica.
export default function DailyBars({
  title,
  unit,
  icon,
  color,
  days,
  selectedKey,
  decimals = 0,
}) {
  const values = days.map((d) => d.value).filter((v) => v != null);
  const max = values.length ? Math.max(...values) : 1;

  return (
    <div className="chart">
      <div className="chart-head">
        {icon}
        {title}
        <span className="unit">{unit}</span>
      </div>
      <div className="bars">
        {days.map((d) => {
          const text = d.value != null ? d.value.toFixed(decimals) : null;
          return (
            <div
              key={d.key}
              className={"bar-slot" + (d.key === selectedKey ? " selected" : "")}
              title={`${d.full}: ${text != null ? `${text} ${unit}` : "sin datos"}`}
            >
              {text != null ? (
                <>
                  <span className="bar-value num">{text}</span>
                  <div
                    className="bar"
                    style={{
                      height: `${Math.max(4, (d.value / max) * 78)}%`,
                      background: color,
                    }}
                  />
                </>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="bar-labels">
        {days.map((d) => (
          <span key={d.key} className={d.key === selectedKey ? "selected" : ""}>
            {d.short}
          </span>
        ))}
      </div>
    </div>
  );
}
