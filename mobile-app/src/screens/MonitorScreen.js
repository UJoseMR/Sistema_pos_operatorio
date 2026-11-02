import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import PpgWave from "../components/PpgWave";
import { DropIcon, GearIcon, HeartIcon, ThermometerIcon } from "../components/Icons";
import { READING_MAX_AGE_MS } from "../lib/useEsp32";
import { colors, radius, spacing } from "../theme";

function statusInfo(status) {
  switch (status) {
    case "connected":
      return { label: "Conectado", color: colors.ok };
    case "connecting":
      return { label: "Conectando", color: colors.warn };
    case "error":
      return { label: "Error", color: colors.danger };
    case "disconnected":
      return { label: "Desconectado", color: colors.danger };
    case "no_key":
      return { label: "Falta clave de cifrado", color: colors.danger };
    case "key_error":
      return { label: "Clave incorrecta", color: colors.danger };
    case "insecure":
      return { label: "Datos sin cifrar rechazados", color: colors.danger };
    default:
      return { label: "Sin IP", color: colors.muted };
  }
}

function fmtTime(ts) {
  if (!ts) return "--:--:--";
  return new Date(ts).toLocaleTimeString();
}

// Corazon que late al ritmo del BPM.
function BeatingHeart({ bpm }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    scale.setValue(1);
    if (!bpm) return undefined;
    const period = (60 / bpm) * 1000;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.14,
          duration: period * 0.15,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: period * 0.3,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(period * 0.55),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bpm, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <HeartIcon size={56} color={colors.bpm} />
    </Animated.View>
  );
}

export default function MonitorScreen({
  reading,
  status,
  ip,
  lastAt,
  streamMode,
  lastSavedAt,
  firebaseError,
  onOpenSettings,
}) {
  // Reloj interno para detectar cuando la ultima lectura se vuelve vieja.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Si no llegan lecturas validas en 5 s, no se muestran valores viejos.
  const fresh = !!lastAt && now - lastAt <= READING_MAX_AGE_MS;
  const data = fresh ? reading : null;

  const st = statusInfo(status);
  const hasFinger = !!data?.finger;
  const bpm = hasFinger && data?.validBpm ? Math.round(data.bpm) : null;
  const spo2 = hasFinger && data?.validSpo2 ? Math.round(data.spo2) : null;
  const temp = data?.temp != null ? Number(data.temp).toFixed(1) : null;

  let hint = "Coloca el dedo en el sensor";
  if (!ip) hint = "Configura la IP del ESP32";
  else if (!data) hint = "Sin datos del ESP32";
  else if (hasFinger && bpm == null) hint = "Calculando...";
  else if (hasFinger) hint = "Dedo detectado";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>MONITOR POST-OP</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: st.color }]} />
            <Text style={styles.statusText}>{st.label}</Text>
          </View>
        </View>
        <Pressable
          style={styles.iconBtn}
          onPress={onOpenSettings}
          accessibilityLabel="Configuracion"
        >
          <GearIcon color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.center}>
        <View style={styles.heartRow}>
          <BeatingHeart bpm={bpm} />
          <View style={styles.bpmBox}>
            <Text style={styles.bpmValue}>{bpm ?? "--"}</Text>
            <Text style={styles.bpmUnit}>lpm</Text>
          </View>
        </View>

        <PpgWave
          samples={hasFinger ? data.ppg : null}
          fs={data?.fs}
          stamp={data ? lastAt : 0}
        />

        <View style={styles.vitals}>
          <View style={styles.vital}>
            <View style={styles.vitalLabel}>
              <DropIcon color={colors.spo2} />
              <Text style={styles.vitalLabelText}>Saturacion O₂</Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.vitalValue}>{spo2 ?? "--"}</Text>
              <Text style={styles.vitalUnit}>%</Text>
            </View>
          </View>
          <View style={styles.vital}>
            <View style={styles.vitalLabel}>
              <ThermometerIcon color={colors.temp} />
              <Text style={styles.vitalLabelText}>Temperatura</Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.vitalValue}>{temp ?? "--"}</Text>
              <Text style={styles.vitalUnit}>°C</Text>
            </View>
          </View>
        </View>

        <Text style={styles.hint}>{hint}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footText}>
          Ultima lectura {fmtTime(lastAt)} · Guardado{" "}
          {lastSavedAt ? fmtTime(lastSavedAt) : "--"}
        </Text>
        <Text style={[styles.footText, streamMode ? { color: colors.accent } : null]}>
          {streamMode ? "Monitoreo web activo" : "Monitoreo web inactivo"}
        </Text>
        {firebaseError ? (
          <Text style={[styles.footText, { color: colors.danger }]} numberOfLines={2}>
            Firebase: {firebaseError}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.lg,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.lg,
  },
  heartRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  bpmBox: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  bpmValue: {
    color: colors.text,
    fontSize: 68,
    fontWeight: "700",
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
  },
  bpmUnit: {
    color: colors.muted,
    fontSize: 17,
    fontWeight: "600",
    marginLeft: 6,
    marginBottom: 12,
  },
  vitals: {
    flexDirection: "row",
    gap: spacing.md,
  },
  vital: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  vitalLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  vitalLabelText: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "600",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  vitalValue: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  vitalUnit: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 4,
    marginBottom: 5,
  },
  hint: {
    color: colors.textSoft,
    fontSize: 14,
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
    gap: 2,
    paddingBottom: spacing.md,
  },
  footText: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
  },
});
