import { useEffect, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, StyleSheet, FlatList } from "react-native";
import Screen from "../components/Screen";
import api from "../lib/api";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import ProgressBar from "../components/ProgressBar";
import Feather from "@expo/vector-icons/Feather";
import { useAuth } from "../lib/auth";
import Text from "../components/Text";

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const [wallet, setWallet] = useState<any>();
  const [transactions, setTransactions] = useState<any[]>([]);
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(user);
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  const load = () =>
    api.get("/wallet").then((res) => {
      setWallet(res.data.data.wallet || res.data.data);
      setTransactions(res.data.data.transactions || res.data.data?.walletTx || []);
    });

  useEffect(() => {
    load();
    if (user) {
      api.get("/auth/me").then((res) => setProfile(res.data.data.user)).catch(() => { });
    }
  }, []);

  useEffect(() => {
    setProfile(user);
  }, [user]);

  const balance = wallet?.balance || wallet?.wallet?.balance || 0;
  const membershipLevel = profile?.membershipLevel || "None";
  const thresholds =
    wallet?.membershipThresholds ||
    wallet?.settings?.membershipThresholds || {
      silver: 1000000,
      gold: 2000000,
      platinum: 4000000,
      diamond: 6000000,
    };
  const graceUntil = profile?.membershipGraceUntil ? new Date(profile.membershipGraceUntil) : null;
  const inGrace = !!(graceUntil && graceUntil.getTime() > Date.now() && membershipLevel !== "None");
  const currentThreshold = useMemo(() => {
    const map: Record<string, number> = {
      Silver: thresholds.silver,
      Gold: thresholds.gold,
      Platinum: thresholds.platinum,
      Diamond: thresholds.diamond,
    };
    return map[membershipLevel] || 0;
  }, [membershipLevel, thresholds]);

  const membershipTone = useMemo(() => {
    const tones: Record<string, { cardBg: string; accent: string; badgeBg: string; badgeText: string; ring: string }> = {
      None: { cardBg: "#f8fafc", accent: "#64748b", badgeBg: "#e2e8f0", badgeText: "#0f172a", ring: "#cbd5e1" },
      Silver: { cardBg: "#f7f7f7", accent: "#94a3b8", badgeBg: "#e2e8f0", badgeText: "#0f172a", ring: "#cbd5e1" },
      Gold: { cardBg: "#fff7ed", accent: "#ea9b2b", badgeBg: "#fef3c7", badgeText: "#92400e", ring: "#fcd34d" },
      Platinum: { cardBg: "#f4f4f5", accent: "#6b7280", badgeBg: "#e4e4e7", badgeText: "#27272a", ring: "#d4d4d8" },
      Diamond: { cardBg: "#f0f9ff", accent: "#0ea5e9", badgeBg: "#e0f2fe", badgeText: "#0c4a6e", ring: "#7dd3fc" },
    };
    const base = tones[membershipLevel] || tones.None;
    if (isDark) {
      return {
        cardBg: palette.card,
        accent: palette.accent,
        badgeBg: palette.surface,
        badgeText: palette.text,
        ring: palette.border,
      };
    }
    return base;
  }, [membershipLevel, palette, isDark]);

  const { nextLabel, remaining, progress } = useMemo(() => {
    const levels = [
      { name: "None", min: 0 },
      { name: "Silver", min: thresholds.silver },
      { name: "Gold", min: thresholds.gold },
      { name: "Platinum", min: thresholds.platinum },
      { name: "Diamond", min: thresholds.diamond },
    ];
    const currentIdx = levels.findIndex((l) => l.name === membershipLevel);
    const next = levels[currentIdx + 1];
    if (!next) return { nextLabel: "Max", remaining: 0, progress: 1 };

    const remaining = Math.max(0, next.min - balance);
    const range = next.min - levels[currentIdx].min || 1;
    const progress = Math.min(1, (balance - levels[currentIdx].min) / range);
    return { nextLabel: next.name, remaining, progress };
  }, [balance, membershipLevel, thresholds]);

  return (
    <Screen showBack backLabel={t("back") ?? "Back"}>
      <Text style={styles.title}>{t("wallet")}</Text>

        <View style={[styles.walletCard, { backgroundColor: membershipTone.cardBg }]}>
          <View style={[styles.walletGlowA, { backgroundColor: membershipTone.accent }]} />
          <View style={[styles.walletGlowB, { backgroundColor: membershipTone.accent }]} />
          <View style={styles.walletRow}>
            <View style={styles.walletTextCol}>
              <View style={styles.walletHeader}>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <Text style={styles.walletLabel}>{t("balance")}</Text>
                  {/* <Entypo name="info-with-circle" size={18} color={palette.muted} /> */}
                </View>
                <View style={[styles.levelPill, { backgroundColor: membershipTone.badgeBg, borderColor: membershipTone.ring }]}>
                  <Feather name="award" size={14} color={membershipTone.badgeText} />
                  <Text style={[styles.levelPillText, { color: membershipTone.badgeText }]}>
                    {membershipLevel === "None" ? (t("standard") ?? "Standard") : membershipLevel}
                  </Text>
                </View>
              </View>
              <Text style={styles.walletValue}>{balance.toLocaleString()} <Text style={{ fontWeight: "400", fontSize: 18 }}>SYP</Text></Text>
            </View>
          </View>
          <View style={{ marginTop: 10 }}>
            <ProgressBar progress={progress} />
            <View style={styles.walletFooterRow}>
              {/* <View>
                <Text style={styles.walletMiniLabel}>{t("balance")}</Text>
                <Text style={styles.walletMiniValue}>{balance.toLocaleString()} SYP</Text>
              </View> */}
              {/* <View style={{ }}> */}
              {remaining > 0 && <Text style={styles.walletMiniLabel}>{t("remainingToNext") ?? "Remaining to"}{nextLabel}</Text>}
              <Text style={styles.walletMiniValue}>
                {remaining > 0 ? `${remaining.toLocaleString()} SYP` : t("congrats") ?? "Top level"}
              </Text>
              {/* </View> */}
            </View>

            {inGrace && (
              <View style={[styles.graceBox, { borderColor: membershipTone.ring, backgroundColor: isDark ? palette.surface : "#fffaf0" }]}>
                <Text style={styles.graceTitle}>{t("gracePeriodActive") ?? "Grace period active"}</Text>
                <Text style={styles.graceCopy}>
                  {(t("graceKeepLevel") ?? "Keep your balance above")} {currentThreshold.toLocaleString()} SYP
                </Text>
                <Text style={[styles.graceCopy, { color: palette.muted }]}>
                  {(t("graceUntil") ?? "Grace until")}: {graceUntil?.toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        </View>

      <Text style={[styles.cardTitle, { marginBottom: 8 }]}>{t("walletLedger") ?? "Wallet ledger"}</Text>

      <View style={{ flex: 1, marginBottom: insets.bottom + 10 }}>
        <FlatList
          data={transactions}
          keyExtractor={(_, idx) => String(idx)}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          renderItem={({ item }: any) => (
            <View style={styles.txRow}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: isRTL?0:5 }}>
                  {item.type == "CREDIT" && <Feather name="arrow-down-circle" size={18} color={'#009933'} />}
                  {item.type == "DEBIT" && <Feather name="arrow-up-circle" size={18} color={'#f00000'} />}
                  <Text style={styles.txAmount}>{(item.amount || 0).toLocaleString()} SYP</Text>
                </View>

                {/* <Text style={styles.txMeta}>{item.type || item.source || "-"}</Text> */}

                <Text style={[styles.txMeta]}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                </Text>
              </View>
              {item.balanceAfter !== undefined && (
                <Text style={styles.txMeta}>{item.balanceAfter.toLocaleString()} SYP</Text>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.muted}>{t("noTransactions") ?? "No transactions yet"}</Text>}
        />
      </View>
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12, textAlign: "left" },
    card: {
      backgroundColor: palette.card,
      padding: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: palette.border,
      marginBottom: 12,
      gap: 8,
    },
    balance: { color: palette.text, fontSize: 32, fontWeight: "800", textAlign:'left' },
    muted: { color: palette.muted, textAlign:'left' },
    cardTitle: { color: palette.text, fontSize: 18, fontWeight: "700", textAlign:'left' },
    rowCard: { backgroundColor: palette.card, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.border },
    value: { color: palette.text, fontWeight: "700" },
    walletCard: {
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
      overflow: "hidden",
      marginBottom: 16,
    },
    walletGlowA: { position: "absolute", width: 220, height: 220, borderRadius: 999, opacity: 0.12, top: -120, left: -110 },
    walletGlowB: { position: "absolute", width: 260, height: 260, borderRadius: 999, opacity: 0.08, bottom: -160, right: -140 },
    walletRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    walletTextCol: { flex: 1, gap: 8 },
    walletHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    walletLabel: { color: palette.text, fontSize: 18, fontWeight: "700", textAlign:  "left" },
    walletValue: { color: palette.text, fontSize: 28, fontWeight: "900", textAlign:  "left" },
    walletFooterRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
    walletMiniLabel: { color: palette.muted, fontWeight: "700", fontSize: 12 },
    walletMiniValue: { color: palette.text, fontWeight: "800", fontSize: 14 },
    graceBox: {
      marginTop: 10,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      gap: 4,
    },
    graceTitle: { color: palette.accent, fontWeight: "800", fontSize: 13 },
    graceCopy: { color: palette.text, fontSize: 12 },
    levelPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    levelPillText: { color: palette.text, fontWeight: "800", fontSize: 12 },
    txRow: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.card,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    txAmount: { color: palette.text, fontWeight: "800" },
    txMeta: { color: palette.muted, fontSize: 12 },
  });
