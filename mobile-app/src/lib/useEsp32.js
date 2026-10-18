import { useEffect, useRef, useState } from "react";

// Hook que mantiene una conexion WebSocket con el ESP32.
// El ESP32 publica un JSON por cada ciclo de medicion (~1 vez/segundo).
export default function useEsp32(ip, port = 81) {
  const [status, setStatus] = useState("idle"); // idle | connecting | connected | error
  const [reading, setReading] = useState(null);
  const [lastAt, setLastAt] = useState(null);

  const wsRef = useRef(null);

  useEffect(() => {
    if (!ip) {
      setStatus("idle");
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

      ws.onopen = () => {
        if (!stopped) setStatus("connected");
      };

      ws.onmessage = (event) => {
        if (stopped) return;
        try {
          const data = JSON.parse(event.data);
          setReading(data);
          setLastAt(Date.now());
          setStatus("connected");
        } catch (e) {
          // ignora mensajes no-JSON
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
