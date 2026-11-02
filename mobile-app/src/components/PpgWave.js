import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { appendChunk, ppgFrame } from "../lib/ppg";
import { colors, radius } from "../theme";

const H = 80;

// Onda de pulso real (PPG) medida por el MAX30102. Cada lectura trae un
// bloque de muestras; el bloque entra por la derecha mientras la grafica
// se desplaza durante el tiempo que dura ese bloque (~1 s).
export default function PpgWave({ samples, fs = 25, stamp, color = colors.bpm }) {
  const [width, setWidth] = useState(0);
  const [frame, setFrame] = useState({ d: "", chunkW: 0 });
  const bufferRef = useRef({ raw: [], stamp: 0 });
  const shift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (stamp !== bufferRef.current.stamp) {
      bufferRef.current = appendChunk(bufferRef.current, samples, fs, stamp);
    }
    if (!width || !samples?.length) {
      setFrame({ d: "", chunkW: 0 });
      return undefined;
    }
    const next = ppgFrame(bufferRef.current, samples.length, fs, width, H);
    setFrame(next);

    shift.setValue(0);
    const anim = Animated.timing(shift, {
      toValue: -next.chunkW,
      duration: (samples.length / fs) * 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
    // Solo se recalcula cuando llega un bloque nuevo (stamp) o cambia el ancho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, width]);

  const svgW = width + frame.chunkW;

  return (
    <View
      style={styles.box}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width ? (
        <Animated.View style={{ transform: [{ translateX: shift }] }}>
          <Svg width={svgW} height={H}>
            <Path
              d={frame.d || `M0 ${H / 2} L${svgW} ${H / 2}`}
              fill="none"
              stroke={frame.d ? color : colors.muted}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: H,
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: colors.cardSoft,
  },
});
