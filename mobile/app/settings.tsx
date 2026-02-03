import { useMemo, useState } from "react";
import { View, StyleSheet, Switch, TouchableOpacity } from "react-native";
import Screen from "../components/Screen";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import Text from "../components/Text";

export default function SettingsScreen() {
  const [notifications, setNotifications] = useState(true);
  const { palette, mode, setMode } = useTheme();
  const { lang, setLang, t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  return (
    <Screen showBack backLabel={t("back") ?? "Back"}>
      <Text style={styles.title}>{t("settings")}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.muted}>{t("pushNotifications")}</Text>
          <Switch value={notifications} onValueChange={setNotifications} />
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("language")}</Text>
        <View style={styles.row}>
          {["en", "ar"].map((code) => (
            <TouchableOpacity key={code} style={[styles.pill, lang === code && styles.pillActive]} onPress={() => setLang(code as any)}>
              <Text style={styles.pillText}>{code.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.cardTitle, { marginTop: 12 }]}>{t("theme")}</Text>
        <View style={styles.row}>
          {(["system", "light", "dark"] as const).map((opt) => (
            <TouchableOpacity key={opt} style={[styles.pill, mode === opt && styles.pillActive]} onPress={() => setMode(opt)}>
              <Text style={styles.pillText}>{t(opt)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12, textAlign: isRTL ? "right" : "left" },
    card: { backgroundColor: palette.card, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.border, gap: 8, marginBottom: 12 },
    muted: { color: palette.muted, textAlign: isRTL ? "right" : "left" },
    value: { color: palette.text, fontWeight: "700", textAlign: isRTL ? "right" : "left" },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
    cardTitle: { color: palette.text, fontSize: 16, fontWeight: "700" },
    pill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    pillActive: { backgroundColor: palette.accent, borderColor: palette.accent },
    pillText: { color: palette.text, fontWeight: "700" },
  });
