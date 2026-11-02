import { useMemo, useRef } from "react";
import { appendChunk, ppgFrame } from "../lib/ppg";

const W = 600;
const H = 90;

// Onda de pulso real (PPG) medida por el MAX30102. Cada lectura de /live
// trae un bloque de muestras; el bloque entra por la derecha mientras la
// grafica se desplaza durante el tiempo que dura ese bloque (~1 s).
export default function PpgWave({ samples, fs = 25, stamp, color = "var(--red)" }) {
  const bufferRef = useRef({ raw: [], stamp: 0 });

  const frame = useMemo(() => {
    if (stamp !== bufferRef.current.stamp) {
      bufferRef.current = appendChunk(bufferRef.current, samples, fs, stamp);
    }
    if (!samples?.length) return { d: "", chunkW: 0, duration: 1 };
    return {
      ...ppgFrame(bufferRef.current, samples.length, fs, W, H),
      duration: samples.length / fs,
    };
    // Solo se recalcula cuando llega un bloque nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);

  return (
    <div className="wave">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <g
          key={stamp}
          className={"wave-track" + (frame.d ? " moving" : "")}
          style={{ "--duration": `${frame.duration}s`, "--shift": `${-frame.chunkW}px` }}
        >
          <path
            d={frame.d || `M0 ${H / 2} L${W} ${H / 2}`}
            fill="none"
            stroke={frame.d ? color : "var(--muted)"}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
    </div>
  );
}
