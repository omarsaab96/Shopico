import { Link } from "expo-router";
import { useMemo } from "react";
import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
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
      <Text style={styles.title}>{t("profile")}</Text>
      {user ? (
        <View style={styles.card}>
          <Text style={styles.title}>{user?.name}</Text>
          <Text style={styles.muted}>{user?.email}</Text>
          <Text style={styles.muted}>
            {t("role")}: {user?.role || "-"}
          </Text>
          <Button title={t("logout")} onPress={logout} />
        </View>
      ) : (
        <View style={styles.emptyBox}>
          <Text style={styles.muted}>{t("loginToSeeOrders") ?? "Please login to view your orders."}</Text>
          <Link href="/auth/login" asChild>
            <TouchableOpacity style={styles.loginBtn}>
              <Text style={styles.loginBtnText}>{t("login")}</Text>
            </TouchableOpacity>
          </Link>
        </View>
      )}

      <Link href="/settings" style={styles.link}>
        {t("settings")}
      </Link>
      <Link href="/addresses" style={styles.link}>
        {t("savedAddresses") ?? "Addresses"}
      </Link>
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    card: { backgroundColor: palette.card, padding: 16, borderRadius: 14, gap: 8, borderWidth: 1, borderColor: palette.border },
    title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12, textAlign: isRTL ? "right" : "left" },
    muted: { color: palette.muted },
    link: { color: palette.accent, marginTop: 12, textAlign: isRTL ? "right" : "left" },
    emptyBox: {
      backgroundColor: palette.card,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      gap: 12,
    },
    loginBtn: {
      backgroundColor: palette.accent,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
    },
    loginBtnText: { color: "#fff", fontWeight: "700" },
  });
