export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Clave local YYYY-MM-DD (no UTC) para agrupar por dia.
export function dayKey(d) {
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${day}`;
}

export function sameDay(a, b) {
  return dayKey(a) === dayKey(b);
}

export function avg(values) {
  const v = values.filter((n) => typeof n === "number" && !Number.isNaN(n));
  if (!v.length) return null;
  return v.reduce((s, n) => s + n, 0) / v.length;
}

export function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
