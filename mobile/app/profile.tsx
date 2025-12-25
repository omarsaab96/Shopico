import { Link } from "expo-router";
import { useMemo } from "react";
import { Text, View, StyleSheet } from "react-native";
import Button from "../components/Button";
import Screen from "../components/Screen";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

export default function Profile() {
  const { user, logout } = useAuth();
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>{user?.name || t("guest")}</Text>
        <Text style={styles.muted}>{user?.email}</Text>
        <Text style={styles.muted}>
          {t("role")}: {user?.role || "-"}
        </Text>
        <Button title={t("logout")} onPress={logout} />
      </View>
      <Link href="/settings" style={styles.link}>
        {t("settings")}
      </Link>
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    card: { backgroundColor: palette.card, padding: 16, borderRadius: 14, gap: 8, borderWidth: 1, borderColor: palette.border },
    title: { color: palette.text, fontSize: 22, fontWeight: "800", textAlign: isRTL ? "right" : "left" },
    muted: { color: palette.muted },
    link: { color: palette.accent, marginTop: 12, textAlign: isRTL ? "right" : "left" },
  });
