import { useEffect, useState } from "react";
import { Text, View, StyleSheet, Switch } from "react-native";
import Screen from "../components/Screen";
import api from "../lib/api";
import { palette } from "../styles/theme";

export default function SettingsScreen() {
  const [settings, setSettings] = useState<any>();
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    api.get("/settings").then((res) => setSettings(res.data.data));
  }, []);

  return (
    <Screen>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.card}>
        <Text style={styles.muted}>Store location</Text>
        <Text style={styles.value}>
          {settings?.storeLat}, {settings?.storeLng}
        </Text>
        <View style={styles.row}>
          <Text style={styles.muted}>Push notifications</Text>
          <Switch value={notifications} onValueChange={setNotifications} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12 },
  card: { backgroundColor: palette.card, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#1f2937", gap: 8 },
  muted: { color: palette.muted },
  value: { color: palette.text, fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
