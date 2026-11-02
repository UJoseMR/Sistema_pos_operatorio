// ============================================================
// ONDA DE PULSO (PPG) DEL MAX30102
// ------------------------------------------------------------
// El ESP32 envia en cada lectura las muestras IR crudas del
// ciclo ("ppg", ~25 por segundo). Aqui se acumulan, se limpian
// y se convierten en el trazo que se dibuja.
// ============================================================

export const PPG_WINDOW_SEC = 4; // segundos visibles en la grafica
const MAX_GAP_MS = 2500; // si faltan datos mas tiempo, se reinicia la onda

// Agrega un bloque de muestras al buffer. Devuelve el buffer nuevo
// (vacio si no hay muestras o si hubo un corte en los datos).
export function appendChunk(buffer, samples, fs, stamp) {
  if (!Array.isArray(samples) || samples.length === 0) return { raw: [], stamp };
  const continuous = buffer.stamp && stamp - buffer.stamp < MAX_GAP_MS;
  const raw = (continuous ? buffer.raw : []).concat(samples);
  // Se guardan 2 s extra para que el filtro tenga contexto en el borde izquierdo.
  const keep = Math.round(fs * (PPG_WINDOW_SEC + 2)) + samples.length;
  return { raw: raw.slice(-keep), stamp };
}

// Quita la linea base (componente DC) con un promedio movil centrado de ~1 s,
// invierte la senal (en IR, mas sangre = menos luz reflejada, asi el latido
// queda hacia arriba) y suaviza con 3 muestras para bajar el ruido.
export function filterPpg(raw, fs) {
  const n = raw.length;
  const half = Math.max(1, Math.round(fs / 2));
  const ac = new Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
      sum += raw[j];
      count++;
    }
    ac[i] = sum / count - raw[i];
  }
  return ac.map(
    (v, i) => (ac[Math.max(0, i - 1)] + v + ac[Math.min(n - 1, i + 1)]) / 3
  );
}

// Trazo SVG de los valores con separacion `dx`. La ultima muestra queda en
// `xEnd`; la altura se ajusta al rango de lo visible (ganancia automatica).
export function buildPpgPath(values, dx, height, xEnd) {
  if (values.length < 2) return "";
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const range = hi - lo || 1;
  const pad = height * 0.12;
  const x0 = xEnd - (values.length - 1) * dx;
  const y = (v) => (height - pad - ((v - lo) / range) * (height - pad * 2)).toFixed(1);
  return values
    .map((v, i) => `${i ? "L" : "M"}${(x0 + i * dx).toFixed(1)} ${y(v)}`)
    .join(" ");
}

// Calcula el trazo a dibujar: ventana visible + el bloque nuevo, que entra
// por la derecha mientras la grafica se desplaza `chunkW`.
export function ppgFrame(buffer, chunkLen, fs, width, height) {
  const visible = Math.round(fs * PPG_WINDOW_SEC);
  const dx = width / visible;
  const chunkW = chunkLen * dx;
  if (buffer.raw.length < fs) return { d: "", chunkW: 0 };
  // Se descarta el ultimo medio segundo: ahi el promedio movil aun no tiene
  // muestras posteriores y la linea base sale distorsionada (~0.5 s de retraso).
  const settled = filterPpg(buffer.raw, fs).slice(0, -Math.round(fs / 2));
  const filtered = settled.slice(-(visible + chunkLen));
  return { d: buildPpgPath(filtered, dx, height, width + chunkW), chunkW };
}
