import { Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
import Button from "../components/Button";
import Screen from "../components/Screen";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import api from "../lib/api";

export default function Profile() {
  const { user, logout } = useAuth();
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const [pointsData, setPointsData] = useState<any>();
  const [settings, setSettings] = useState<any>();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  useEffect(() => {
    let mounted = true;
    if (!user) {
      setPointsData(undefined);
      setSettings(undefined);
      return;
    }
    Promise.allSettled([api.get("/points"), api.get("/settings")]).then(([pointsRes, settingsRes]) => {
      if (!mounted) return;
      if (pointsRes.status === "fulfilled") setPointsData(pointsRes.value.data.data);
      if (settingsRes.status === "fulfilled") setSettings(settingsRes.value.data.data);
    });
    return () => {
      mounted = false;
    };
  }, [user]);

  const points = pointsData?.points ?? user?.points ?? 0;
  const formattedPoints = Number(points || 0).toLocaleString();
  const pointsPerAmount = settings?.pointsPerAmount;
  const earnRateTemplate = t("pointEarnRate");
  const earnRateCopy = pointsPerAmount
    ? earnRateTemplate.replace("{amount}", pointsPerAmount.toLocaleString())
    : undefined;

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
          <View style={styles.pointsBox}>
            <View>
              <Text style={styles.muted}>{t("pointsBalance")}</Text>
              <Text style={styles.pointsValue}>
                {formattedPoints} {t("rewards")}
              </Text>
              {earnRateCopy && <Text style={styles.muted}>{earnRateCopy}</Text>}
            </View>
            <Link href="/points" asChild>
              <TouchableOpacity style={styles.pointsLink}>
                <Text style={styles.pointsLinkText}>{t("viewPoints")}</Text>
              </TouchableOpacity>
            </Link>
          </View>
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
      {user&&<Link href="/addresses" style={styles.link}>
        {t("savedAddresses") ?? "Addresses"}
      </Link>}
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    card: { backgroundColor: palette.card, padding: 16, borderRadius: 14, gap: 8, borderWidth: 1, borderColor: palette.border },
    title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12, textAlign: isRTL ? "right" : "left" },
    muted: { color: palette.muted },
    pointsBox: {
      marginTop: 8,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.background,
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    pointsValue: { color: palette.text, fontSize: 28, fontWeight: "800", marginVertical: 4, textAlign: isRTL ? "right" : "left" },
    pointsLink: {
      backgroundColor: palette.accent,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
    },
    pointsLinkText: { color: "#fff", fontWeight: "700" },
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
