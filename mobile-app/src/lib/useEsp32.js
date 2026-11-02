import { useEffect, useRef, useState } from "react";
import {
  PlaintextError,
  createSession,
  hasKey,
  helloMessage,
  openFrame,
} from "./secureChannel";

// El ESP32 envia ~1 lectura/s; si la ultima tiene mas de 5 s se considera
// que no hay datos (conexion perdida o mensajes rechazados).
export const READING_MAX_AGE_MS = 5000;

// Hook que mantiene una conexion WebSocket cifrada con el ESP32.
// El ESP32 publica un JSON cifrado por cada ciclo de medicion (~1 vez/segundo).
export default function useEsp32(ip, port = 81) {
  // idle | connecting | connected | error | disconnected | no_key | key_error | insecure
  const [status, setStatus] = useState("idle");
  const [reading, setReading] = useState(null);
  const [lastAt, setLastAt] = useState(null);

  const wsRef = useRef(null);

  useEffect(() => {
    if (!ip) {
      setStatus("idle");
      return undefined;
    }
    if (!hasKey) {
      setStatus("no_key");
      return undefined;
    }

    let stopped = false;
    let reconnectTimer = null;

    const scheduleReconnect = () => {
      if (stopped) return;
      reconnectTimer = setTimeout(connect, 3000);
    };

    const connect = () => {
      if (stopped) return;
      setStatus("connecting");

      let ws;
      try {
        ws = new WebSocket(`ws://${ip}:${port}`);
      } catch (e) {
        setStatus("error");
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      // Cada conexion usa un nonce de sesion nuevo.
      const session = createSession();

      ws.onopen = () => {
        if (stopped) return;
        setStatus("connected");
        ws.send(helloMessage(session));
      };

      ws.onmessage = (event) => {
        if (stopped) return;
        try {
          const data = openFrame(session, event.data);
          setReading(data);
          setLastAt(Date.now());
          setStatus("connected");
        } catch (e) {
          // Nunca se muestran datos que no pasaron la verificacion.
          setStatus(e instanceof PlaintextError ? "insecure" : "key_error");
        }
      };

      ws.onerror = () => {
        if (!stopped) setStatus("error");
      };

      ws.onclose = () => {
        if (stopped) return;
        setStatus("disconnected");
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [ip, port]);

  return { status, reading, lastAt };
}
