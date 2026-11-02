import { useEffect, useMemo, useState } from "react";
import {
  endAt,
  onDisconnect,
  onValue,
  orderByChild,
  query,
  ref,
  set,
  startAt,
} from "firebase/database";
import { db } from "./lib/firebase";
import { addDays, avg, dayKey, startOfDay } from "./lib/dates";
import LiveMonitor from "./components/LiveMonitor";
import DailyBars from "./components/DailyBars";
import Calendar from "./components/Calendar";
import DayRecords from "./components/DayRecords";
import { DropIcon, HeartIcon, ThermometerIcon } from "./components/Icons";

const CHART_DAYS = 7;

export default function App() {
  const [streamMode, setStreamMode] = useState(false);
  const [live, setLive] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());

  const [selected, setSelected] = useState(() => startOfDay(Date.now()));
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = startOfDay(now);

  // Reloj interno para refrescar "hace Xs" y detectar datos viejos.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Bandera /streamMode controlada por esta web.
  useEffect(
    () =>
      onValue(
        ref(db, "streamMode"),
        (snap) => setStreamMode(snap.val() === true),
        (e) => setError(e.message)
      ),
    []
  );

  // Lectura en vivo (/live), la app movil la actualiza cada segundo.
  useEffect(
    () =>
      onValue(
        ref(db, "live"),
        (snap) => setLive(snap.val()),
        (e) => setError(e.message)
      ),
    []
  );

  // Historial (/readings): los 7 dias que terminan en el dia seleccionado.
  // Para que Firebase filtre en el servidor, agrega en las reglas:
  //   "readings": { ".indexOn": ["timestamp"] }
  const selectedMs = selected.getTime();
  useEffect(() => {
    setLoading(true);
    const from = addDays(selectedMs, -(CHART_DAYS - 1)).getTime();
    const to = addDays(selectedMs, 1).getTime() - 1;
    const q = query(
      ref(db, "readings"),
      orderByChild("timestamp"),
      startAt(from),
      endAt(to)
    );
    return onValue(
      q,
      (snap) => {
        const list = [];
        snap.forEach((child) => {
          list.push({ id: child.key, ...child.val() });
        });
        setRows(list);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      }
    );
  }, [selectedMs]);

  const { chartDays, dayRows } = useMemo(() => {
    const byDay = new Map();
    for (const r of rows) {
      const k = dayKey(r.timestamp);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(r);
    }

    const days = [];
    for (let i = CHART_DAYS - 1; i >= 0; i--) {
      const date = addDays(selectedMs, -i);
      const list = byDay.get(dayKey(date)) || [];
      const finger = list.filter((r) => r.finger);
      days.push({
        key: dayKey(date),
        short: String(date.getDate()),
        full: date.toLocaleDateString("es", {
          weekday: "long",
          day: "numeric",
          month: "short",
        }),
        bpm: avg(finger.map((r) => r.bpm)),
        spo2: avg(finger.map((r) => r.spo2)),
        temp: avg(list.map((r) => r.temp)),
      });
    }

    const sel = (byDay.get(dayKey(selectedMs)) || []).slice();
    sel.sort((a, b) => b.timestamp - a.timestamp);
    return { chartDays: days, dayRows: sel };
  }, [rows, selectedMs]);

  const pick = (field) => chartDays.map((d) => ({ ...d, value: d[field] }));
  const selectedKey = dayKey(selectedMs);

  const toggleLive = async () => {
    try {
      setError(null);
      const flagRef = ref(db, "streamMode");
      if (!streamMode) {
        // Si esta web se cierra o pierde conexion, apagar el modo tiempo real.
        await onDisconnect(flagRef).set(false);
        await set(flagRef, true);
      } else {
        await onDisconnect(flagRef).cancel();
        await set(flagRef, false);
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const selectDay = (date) => {
    setSelected(startOfDay(date));
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  return (
    <main className="app">
      <section className="pane">
        <header className="pane-header">
          <div>
            <p className="eyebrow">Paciente post-operatorio</p>
            <h1 className="pane-title">Monitoreo</h1>
          </div>
          <div className="switch-row">
            {streamMode ? "Activo" : "Inactivo"}
            <button
              className={"ios-switch" + (streamMode ? " on" : "")}
              onClick={toggleLive}
              role="switch"
              aria-checked={streamMode}
              aria-label="Activar monitoreo en tiempo real"
            >
              <span className="knob" />
            </button>
          </div>
        </header>
        {error ? <div className="error">Firebase: {error}</div> : null}
        <LiveMonitor enabled={streamMode} live={live} now={now} />
      </section>

      <section className="pane history">
        <header className="pane-header">
          <div>
            <p className="eyebrow">Promedio diario · ultimos {CHART_DAYS} dias</p>
            <h2 className="pane-title">Historial</h2>
          </div>
        </header>

        <div className="charts">
          <DailyBars
            title="Frec. cardiaca"
            unit="lpm"
            color="var(--bpm)"
            icon={<HeartIcon style={{ color: "var(--bpm)" }} />}
            days={pick("bpm")}
            selectedKey={selectedKey}
          />
          <DailyBars
            title="Saturacion O₂"
            unit="%"
            color="var(--spo2)"
            icon={<DropIcon style={{ color: "var(--spo2)" }} />}
            days={pick("spo2")}
            selectedKey={selectedKey}
          />
          <DailyBars
            title="Temperatura"
            unit="°C"
            color="var(--temp)"
            icon={<ThermometerIcon style={{ color: "var(--temp)" }} />}
            days={pick("temp")}
            selectedKey={selectedKey}
            decimals={1}
          />
        </div>

        <div className="history-body">
          <Calendar
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={selectDay}
            today={today}
          />
          <DayRecords date={selected} rows={dayRows} loading={loading} />
        </div>
      </section>
    </main>
  );
}
