import React, { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";

import useEsp32 from "./src/lib/useEsp32";
import useFirebaseSync from "./src/lib/useFirebaseSync";
import MonitorScreen from "./src/screens/MonitorScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import { colors } from "./src/theme";

const IP_KEY = "@pos:esp32_ip";

export default function App() {
  const [ip, setIp] = useState("");
  const [tab, setTab] = useState("monitor");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(IP_KEY);
        if (saved) setIp(saved);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const { status, reading, lastAt } = useEsp32(ip);

  // Ref con la ultima lectura para que el sincronizador de Firebase la lea.
  const readingRef = useRef(null);
  useEffect(() => {
    readingRef.current = reading;
  }, [reading]);

  const { streamMode, lastSavedAt, error } = useFirebaseSync(readingRef, !!ip);

  const saveIp = useCallback(async (value) => {
    setIp(value);
    try {
      await AsyncStorage.setItem(IP_KEY, value);
    } catch (e) {
      // ignore
    }
  }, []);

  if (!loaded) return null;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      {tab === "monitor" ? (
        <MonitorScreen
          reading={reading}
          status={status}
          ip={ip}
          lastAt={lastAt}
          streamMode={streamMode}
          lastSavedAt={lastSavedAt}
          firebaseError={error}
          onOpenSettings={() => setTab("settings")}
        />
      ) : (
        <SettingsScreen
          ip={ip}
          onSaveIp={saveIp}
          onBack={() => setTab("monitor")}
          status={status}
          streamMode={streamMode}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
