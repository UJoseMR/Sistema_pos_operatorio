import { useEffect, useRef, useState } from "react";
import { onValue, push, ref, set } from "firebase/database";
import { db } from "./firebase";
import { READING_MAX_AGE_MS } from "./useEsp32";

const HISTORY_INTERVAL_MS = 30000; // historial: cada 30 s
const LIVE_POLL_MS = 250; // tiempo real: revisa si hay lectura nueva (solo si streamMode)

// Sincroniza las lecturas hacia Firebase Realtime Database.
//
//  - /readings  -> historial, se guarda cada 30 s
//  - /live      -> cada lectura nueva del ESP32 (~1/s), con la onda de pulso
//                  (ppg). Solo si streamMode.
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
    // Si se perdio la conexion con el ESP32 (o los mensajes no pasan la
    // verificacion) la ultima lectura deja de ser valida: no se guarda.
    if (!d.receivedAt || Date.now() - d.receivedAt > READING_MAX_AGE_MS) {
      return null;
    }
    return {
      // Momento en que llego la lectura, no el del envio a Firebase.
      timestamp: d.receivedAt,
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

  // Tiempo real: cada lectura nueva una sola vez, solo si la web activo
  // streamMode. Asi la web recibe todos los bloques de la onda sin repetir.
  const lastLiveRef = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      if (!enabledRef.current || !streamRef.current) return;
      const payload = buildPayload();
      if (!payload || payload.timestamp === lastLiveRef.current) return;
      lastLiveRef.current = payload.timestamp;
      const d = readingRef.current;
      const ppg = d.finger && Array.isArray(d.ppg) ? d.ppg : null;
      set(ref(db, "live"), { ...payload, ppg, fs: d.fs ?? null }).catch((e) =>
        setError(e.message)
      );
    }, LIVE_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { streamMode, lastSavedAt, error };
}
