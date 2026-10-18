import { useEffect, useRef, useState } from "react";
import { onValue, push, ref, set } from "firebase/database";
import { db } from "./firebase";

const HISTORY_INTERVAL_MS = 30000; // historial: cada 30 s
const LIVE_INTERVAL_MS = 1000; // tiempo real: cada 1 s (solo si streamMode)

// Sincroniza las lecturas hacia Firebase Realtime Database.
//
//  - /readings  -> historial, se guarda cada 30 s
//  - /live      -> ultima lectura, se guarda cada 1 s (solo si streamMode)
//  - /streamMode -> bandera que la app web activa/desactiva
//
// Recibe una ref con la ultima lectura recibida por WebSocket.
export default function useFirebaseSync(readingRef, enabled) {
  const [streamMode, setStreamMode] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [error, setError] = useState(null);

  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const streamRef = useRef(false);

  // Escucha la bandera /streamMode controlada desde la app web.
  useEffect(() => {
    const unsub = onValue(
      ref(db, "streamMode"),
      (snap) => {
        const value = snap.val() === true;
        streamRef.current = value;
        setStreamMode(value);
      },
      (err) => setError(err.message)
    );
    return unsub;
  }, []);

  const buildPayload = () => {
    const d = readingRef.current;
    if (!d) return null;
    return {
      timestamp: Date.now(),
      finger: !!d.finger,
      bpm: d.validBpm ? d.bpm : null,
      spo2: d.validSpo2 ? d.spo2 : null,
      temp: typeof d.temp === "number" ? Number(d.temp.toFixed(2)) : null,
      tempAmb:
        typeof d.tempAmb === "number" ? Number(d.tempAmb.toFixed(2)) : null,
    };
  };

  // Historial: cada 30 s.
  useEffect(() => {
    const id = setInterval(() => {
      if (!enabledRef.current) return;
      const payload = buildPayload();
      if (!payload) return;
      push(ref(db, "readings"), payload)
        .then(() => setLastSavedAt(Date.now()))
        .catch((e) => setError(e.message));
    }, HISTORY_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tiempo real: cada 1 s, solo si la web activo streamMode.
  useEffect(() => {
    const id = setInterval(() => {
      if (!enabledRef.current || !streamRef.current) return;
      const payload = buildPayload();
      if (!payload) return;
      set(ref(db, "live"), payload).catch((e) => setError(e.message));
    }, LIVE_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { streamMode, lastSavedAt, error };
}
