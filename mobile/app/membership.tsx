import { useEffect, useMemo, useState } from "react";
import { Modal, Text, View, StyleSheet } from "react-native";
import Screen from "../components/Screen";
import ProgressBar from "../components/ProgressBar";
import StatCard from "../components/StatCard";
import api from "../lib/api";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

export default function MembershipScreen() {
  const [user, setUser] = useState<any>();
  const [settings, setSettings] = useState<any>();
  const [wallet, setWallet] = useState<any>();
  const [showCongrats, setShowCongrats] = useState(false);
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  useEffect(() => {
    api.get("/auth/me").then((res) => setUser(res.data.data.user));
    api.get("/settings").then((res) => setSettings(res.data.data));
    api.get("/wallet").then((res) => setWallet(res.data.data.wallet));
  }, []);

  const thresholds = settings?.membershipThresholds || { silver: 1000000, gold: 2000000, platinum: 4000000, diamond: 6000000 };
  const balance = wallet?.balance || 0;
  const level = user?.membershipLevel || "None";

  const { nextLabel, remaining, progress } = useMemo(() => {
    const levels = [
      { name: "None", min: 0 },
      { name: "Silver", min: thresholds.silver },
      { name: "Gold", min: thresholds.gold },
      { name: "Platinum", min: thresholds.platinum },
      { name: "Diamond", min: thresholds.diamond },
    ];
    const currentIdx = levels.findIndex((l) => l.name === level);
    const next = levels[currentIdx + 1];
    if (!next) return { nextLabel: "Max", remaining: 0, progress: 1 };
    const remaining = Math.max(0, next.min - balance);
    const range = next.min - levels[currentIdx].min;
    const progress = Math.min(1, (balance - levels[currentIdx].min) / range);
    if (progress === 1 && next.name !== "Diamond") setShowCongrats(true);
    return { nextLabel: next.name, remaining, progress };
  }, [balance, level, thresholds]);

  return (
    <Screen>
      <Text style={styles.title}>{t("membership")}</Text>
      <StatCard label={t("level")} value={level} />
      <View style={styles.card}>
        <Text style={styles.muted}>
          {t("remainingToNext")} {remaining.toLocaleString()} SYP ({nextLabel})
        </Text>
        <ProgressBar progress={progress} />
        <Text style={styles.muted}>
          {t("balance")}: {balance.toLocaleString()} SYP
        </Text>
        <Text style={styles.muted}>
          {t("graceDays")}: {settings?.membershipGraceDays}
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("benefits")}</Text>
        <Text style={styles.muted}>• {t("priorityDelivery")}</Text>
        <Text style={styles.muted}>• {t("loyalOffers")}</Text>
      </View>
      <Modal visible={showCongrats} transparent animationType="slide">
        <View style={styles.modal}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>{t("congrats")}</Text>
            <Text style={styles.muted}>{t("leveledUp")}</Text>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12, textAlign: isRTL ? "right" : "left" },
    card: {
      backgroundColor: palette.card,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      gap: 8,
      marginTop: 12,
    },
    muted: { color: palette.muted },
    cardTitle: { color: palette.text, fontSize: 18, fontWeight: "700" },
    modal: { flex: 1, backgroundColor: "#000000aa", justifyContent: "center", alignItems: "center" },
    modalCard: { backgroundColor: palette.card, padding: 20, borderRadius: 14, borderWidth: 1, borderColor: palette.border, gap: 6 },
  });
