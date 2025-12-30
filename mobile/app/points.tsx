import { useEffect, useMemo, useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import ProgressBar from "../components/ProgressBar";
import Screen from "../components/Screen";
import api from "../lib/api";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

export default function PointsScreen() {
  const [data, setData] = useState<any>();
  const [settings, setSettings] = useState<any>();
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([api.get("/points"), api.get("/settings")]).then(([pointsRes, settingsRes]) => {
      if (!mounted) return;
      if (pointsRes.status === "fulfilled") setData(pointsRes.value.data.data);
      if (settingsRes.status === "fulfilled") setSettings(settingsRes.value.data.data);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const points = data?.points || 0;
  const threshold = data?.rewardThreshold || 100;
  const progress = (points % threshold) / threshold;
  const remaining = threshold - (points % threshold);
  const pointsPerAmount = settings?.pointsPerAmount;
  const earnCopy = pointsPerAmount
    ? t("pointEarnRate").replace("{amount}", pointsPerAmount.toLocaleString())
    : t("earnPointsCopy");

  return (
    <Screen showBack backLabel={t("back") ?? "Back"}>
      <Text style={styles.title}>{t("rewards")}</Text>
      <View style={styles.card}>
        <Text style={styles.value}>{points} <Text style={{fontWeight:"400",fontSize:18}}>Points</Text></Text>
        <ProgressBar progress={progress} />
        <Text style={styles.muted}>
          {remaining} {t("pointsLeft")}
        </Text>
        {data?.rewardAvailable && (
          <Text style={styles.success}>
            {t("redeemAvailable")}: {data?.rewardValue} SYP
          </Text>
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("earnPoints")}</Text>
        <Text style={styles.muted}>{earnCopy}</Text>
        <Text style={styles.cardTitle}>{t("usePointsTitle")}</Text>
        <Text style={styles.muted}>{t("usePointsCopy")}</Text>
      </View>
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12, textAlign: isRTL ? "right" : "left" },
    card: {
      backgroundColor: palette.card,
      padding: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: palette.border,
      gap: 8,
      marginBottom: 12,
    },
    value: { color: palette.text, fontSize: 32, fontWeight: "800" },
    muted: { color: palette.muted },
    success: { color: "#22c55e", fontWeight: "700" },
    cardTitle: { color: palette.text, fontSize: 18, fontWeight: "700" },
  });
