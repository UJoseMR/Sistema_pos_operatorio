import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";

export default function MetricCard({
  label,
  value,
  unit,
  color,
  hint,
  active = true,
}) {
  return (
    <View style={[styles.card, { borderColor: active ? color : colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: active ? color : colors.muted }]} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: active ? color : colors.muted }]}>
          {value}
        </Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
    minHeight: 120,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginTop: spacing.sm,
  },
  value: {
    fontSize: 40,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  unit: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
});
