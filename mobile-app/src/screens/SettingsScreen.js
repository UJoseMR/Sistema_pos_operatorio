import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, radius, spacing } from "../theme";

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

export default function SettingsScreen({
  ip,
  onSaveIp,
  onBack,
  status,
  streamMode,
}) {
  const [value, setValue] = useState(ip || "");
  const [saved, setSaved] = useState(false);

  const valid = IP_REGEX.test(value.trim());

  const handleSave = () => {
    if (!valid) return;
    onSaveIp(value.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Configuracion</Text>
        <Text style={styles.subtitle}>
          Ingresa la IP que aparece en el monitor serie del ESP32.
        </Text>

        <Text style={styles.label}>IP del ESP32</Text>
        <TextInput
          style={[styles.input, !valid && value ? styles.inputError : null]}
          value={value}
          onChangeText={setValue}
          placeholder="192.168.1.50"
          placeholderTextColor={colors.muted}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!valid && value ? (
          <Text style={styles.error}>Formato de IP invalido (ej. 192.168.1.50)</Text>
        ) : null}

        <Text style={styles.hint}>
          El ESP32 publica datos en ws://{valid ? value.trim() : "IP"}:81
        </Text>

        <Pressable
          style={[styles.primaryBtn, !valid && styles.btnDisabled]}
          onPress={handleSave}
          disabled={!valid}
        >
          <Text style={styles.primaryText}>
            {saved ? "Guardado" : "Guardar y conectar"}
          </Text>
        </Pressable>

        <View style={styles.infoCard}>
          <InfoRow label="Estado del socket" value={status} />
          <InfoRow
            label="Tiempo real (web)"
            value={streamMode ? "ACTIVADO" : "desactivado"}
            valueColor={streamMode ? colors.ok : colors.muted}
          />
          <InfoRow label="Puerto WebSocket" value="81" />
        </View>

        <Pressable style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>Volver al monitor</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InfoRow({ label, value, valueColor }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 18,
    letterSpacing: 1,
  },
  infoCard: {
    marginTop: spacing.lg,
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
  },
  infoLabel: { color: colors.muted, fontSize: 13 },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: "700" },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  primaryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  backBtn: {
    marginTop: spacing.lg,
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  backText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "700",
  },
});
