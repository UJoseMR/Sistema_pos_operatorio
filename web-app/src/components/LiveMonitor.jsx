import PpgWave from "./PpgWave";
import { DropIcon, HeartIcon, ThermometerIcon } from "./Icons";

const STALE_MS = 6000;

// Vista minimalista igual a la app movil: corazon + BPM, onda y debajo SpO2 y
// temperatura. Solo muestra datos cuando el monitoreo esta activado.
export default function LiveMonitor({ enabled, live, now }) {
  const fresh = enabled && live?.timestamp && now - live.timestamp < STALE_MS;
  const data = fresh ? live : null;
  const hasFinger = !!data?.finger;
  const bpm = hasFinger && data.bpm != null ? Math.round(data.bpm) : null;
  const spo2 = hasFinger && data.spo2 != null ? Math.round(data.spo2) : null;
  const temp = data?.temp != null ? Number(data.temp).toFixed(1) : null;

  let foot = "";
  if (!enabled) foot = "";
  else if (!data) foot = "Esperando datos de la app movil...";
  else if (!hasFinger) foot = "Coloca el dedo en el sensor";
  else if (bpm == null) foot = "Calculando...";
  else
    foot = `En vivo · actualizado hace ${Math.max(
      0,
      Math.round((now - data.timestamp) / 1000)
    )} s`;

  return (
    <>
      <div className={"monitor" + (enabled ? "" : " off")}>
        <div className="heart-row">
          <HeartIcon
            className={"heart-icon" + (bpm ? " beat" : "")}
            style={bpm ? { "--period": `${60 / bpm}s` } : undefined}
          />
          <div>
            <span className="bpm-value num">{bpm ?? "--"}</span>
            <span className="bpm-unit">lpm</span>
          </div>
        </div>

        <PpgWave
          samples={hasFinger ? data.ppg : null}
          fs={data?.fs ?? undefined}
          stamp={data?.timestamp ?? 0}
        />

        <div className="vitals">
          <div className="vital">
            <div className="vital-label">
              <DropIcon style={{ color: "var(--spo2)" }} />
              Saturacion O₂
            </div>
            <div>
              <span className="vital-value num">{spo2 ?? "--"}</span>
              <span className="vital-unit">%</span>
            </div>
          </div>
          <div className="vital">
            <div className="vital-label">
              <ThermometerIcon style={{ color: "var(--temp)" }} />
              Temperatura
            </div>
            <div>
              <span className="vital-value num">{temp ?? "--"}</span>
              <span className="vital-unit">°C</span>
            </div>
            {data?.tempAmb != null ? (
              <span className="vital-hint">
                Ambiente {Number(data.tempAmb).toFixed(1)} °C
              </span>
            ) : null}
          </div>
        </div>

        {!enabled ? (
          <p className="off-message">
            Activa el monitoreo para recibir los signos vitales en tiempo real.
          </p>
        ) : null}
      </div>
      <div className="monitor-foot">{foot}</div>
    </>
  );
}
