import { useEffect, useRef, useState } from "react";
import { DropIcon, HeartIcon, ThermometerIcon } from "./Icons";
import { avg, capitalize } from "../lib/dates";

const PAGE = 120;

const fmt = (v, decimals = 0) => (v != null ? Number(v).toFixed(decimals) : "--");

// Lista vertical de registros del dia seleccionado. Es la unica zona con
// scroll; los registros se van pintando por bloques al bajar.
export default function DayRecords({ date, rows, loading }) {
  const [count, setCount] = useState(PAGE);
  const scrollRef = useRef(null);

  useEffect(() => {
    setCount(PAGE);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [date]);

  const onScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 200 && count < rows.length) {
      setCount((c) => c + PAGE);
    }
  };

  const withFinger = rows.filter((r) => r.finger);
  const avgBpm = avg(withFinger.map((r) => r.bpm));
  const avgSpo2 = avg(withFinger.map((r) => r.spo2));
  const avgTemp = avg(rows.map((r) => r.temp));

  const title = capitalize(date.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }));

  return (
    <div className="day-list">
      <div className="day-list-head">
        <h3>{title}</h3>
        <span>{loading ? "Cargando..." : `${rows.length} registros`}</span>
      </div>

      <div className="day-summary">
        <div>
          Prom. FC
          <b className="num">{fmt(avgBpm)} lpm</b>
        </div>
        <div>
          Prom. SpO₂
          <b className="num">{fmt(avgSpo2)} %</b>
        </div>
        <div>
          Prom. Temp.
          <b className="num">{fmt(avgTemp, 1)} °C</b>
        </div>
      </div>

      <div className="scroll-area" ref={scrollRef} onScroll={onScroll}>
        {!loading && rows.length === 0 ? (
          <div className="empty">No hay registros para este dia.</div>
        ) : null}
        {rows.slice(0, count).map((r) => {
          const finger = !!r.finger;
          return (
            <div className="record" key={r.id}>
              <span className="record-time num">
                {new Date(r.timestamp).toLocaleTimeString("es", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="record-metric num">
                <HeartIcon style={{ color: "var(--bpm)" }} />
                {finger ? fmt(r.bpm) : "--"} <small>lpm</small>
              </span>
              <span className="record-metric num">
                <DropIcon style={{ color: "var(--spo2)" }} />
                {finger ? fmt(r.spo2) : "--"} <small>%</small>
              </span>
              <span className="record-metric num">
                <ThermometerIcon style={{ color: "var(--temp)" }} />
                {fmt(r.temp, 1)} <small>°C</small>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
