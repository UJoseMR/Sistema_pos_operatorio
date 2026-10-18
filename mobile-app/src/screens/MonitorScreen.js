import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MetricCard from "../components/MetricCard";
import { colors, radius, spacing } from "../theme";

function statusInfo(status) {
  switch (status) {
    case "connected":
      return { label: "Conectado", color: colors.ok };
    case "connecting":
      return { label: "Conectando...", color: colors.warn };
    case "error":
      return { label: "Error", color: colors.danger };
    case "disconnected":
      return { label: "Desconectado", color: colors.danger };
    default:
      return { label: "Sin IP", color: colors.muted };
  }
}

function fmtTime(ts) {
  if (!ts) return "--:--:--";
  return new Date(ts).toLocaleTimeString();
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
  const st = statusInfo(status);
  const hasFinger = !!reading?.finger;
  const bpmValid = !!reading?.validBpm;
  const spo2Valid = !!reading?.validSpo2;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Monitor Post-Op</Text>
          <Text style={styles.subtitle}>
            {ip ? `ESP32 · ${ip}` : "Configura la IP del ESP32"}
          </Text>
        </View>
        <View style={[styles.pill, { borderColor: st.color }]}>
          <View style={[styles.pillDot, { backgroundColor: st.color }]} />
          <Text style={[styles.pillText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>

      <View
        style={[
          styles.fingerBanner,
          {
            borderColor: hasFinger ? colors.ok : colors.warn,
            backgroundColor: hasFinger ? "#10331F" : "#33260F",
          },
        ]}
      >
        <Text
          style={[
            styles.fingerText,
            { color: hasFinger ? colors.ok : colors.warn },
          ]}
        >
          {hasFinger ? "Dedo detectado" : "Coloca el dedo en el sensor"}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.row}>
          <MetricCard
            label="FRECUENCIA CARDIACA"
            value={bpmValid ? Math.round(reading.bpm) : "--"}
            unit="lpm"
            color={colors.bpm}
            active={hasFinger && bpmValid}
            hint={hasFinger && !bpmValid ? "Calculando..." : undefined}
          />
          <MetricCard
            label="SpO2"
            value={spo2Valid ? Math.round(reading.spo2) : "--"}
            unit="%"
            color={colors.spo2}
            active={hasFinger && spo2Valid}
            hint={hasFinger && !spo2Valid ? "Calculando..." : undefined}
          />
        </View>

        <MetricCard
          label="TEMPERATURA CORPORAL"
          value={reading?.temp != null ? Number(reading.temp).toFixed(1) : "--"}
          unit="°C"
          color={colors.temp}
          active={reading?.temp != null}
          hint={
            reading?.tempAmb != null
              ? `Ambiente: ${Number(reading.tempAmb).toFixed(1)} °C`
              : undefined
          }
        />

        <View style={styles.infoCard}>
          <InfoRow label="Ultima lectura" value={fmtTime(lastAt)} />
          <InfoRow
            label="Tiempo real (web)"
            value={streamMode ? "ACTIVADO" : "desactivado"}
            valueColor={streamMode ? colors.ok : colors.muted}
          />
          <InfoRow
            label="Ultimo guardado (30s)"
            value={lastSavedAt ? fmtTime(lastSavedAt) : "esperando..."}
          />
          {firebaseError ? (
            <InfoRow
              label="Firebase"
              value={firebaseError}
              valueColor={colors.danger}
            />
          ) : null}
        </View>
      </ScrollView>

      <Pressable style={styles.settingsBtn} onPress={onOpenSettings}>
        <Text style={styles.settingsText}>Configuracion</Text>
      </Pressable>
    </View>
  );
}

function InfoRow({ label, value, valueColor }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[styles.infoValue, valueColor ? { color: valueColor } : null]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  fingerBanner: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  fingerText: {
    fontSize: 14,
    fontWeight: "700",
  },
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 13,
  },
  infoValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
  settingsBtn: {
    backgroundColor: colors.cardSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
});
