import { useEffect, useMemo, useRef, useState } from "react";
import { Text, TextInput, View, StyleSheet, FlatList, TouchableOpacity, Platform } from "react-native";
import Button from "../components/Button";
import Screen from "../components/Screen";
import api from "../lib/api";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import ProgressBar from "../components/ProgressBar";
import Entypo from "@expo/vector-icons/Entypo";
import Feather from "@expo/vector-icons/Feather";
import { useAuth } from "../lib/auth";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider, BottomSheetView } from "@gorhom/bottom-sheet";

export default function WalletScreen() {
  const [wallet, setWallet] = useState<any>();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [amount, setAmount] = useState("50000");
  const [method, setMethod] = useState("CASH_STORE");
  const [topupSubmitting, setTopupSubmitting] = useState(false);
  const topupSheetRef = useRef<BottomSheetModal>(null);
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);
  const renderBackdrop = useMemo(
    () => (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    []
  );

  const load = () =>
    api.get("/wallet").then((res) => {
      setWallet(res.data.data.wallet || res.data.data);
      setTransactions(res.data.data.transactions || res.data.data?.walletTx || []);
    });

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    setTopupSubmitting(true);
    try {
      await api.post("/wallet/topups", { amount: Number(amount), method });
      load();
      topupSheetRef.current?.dismiss();
    } finally {
      setTopupSubmitting(false);
    }
  };

  const balance = wallet?.balance || wallet?.wallet?.balance || 0;
  const membershipLevel = user?.membershipLevel || "None";
  const thresholds =
    wallet?.membershipThresholds ||
    wallet?.settings?.membershipThresholds || {
      silver: 1000000,
      gold: 2000000,
      platinum: 4000000,
      diamond: 6000000,
    };

  const membershipTone = useMemo(() => {
    const tones: Record<string, { cardBg: string; accent: string; badgeBg: string; badgeText: string; ring: string }> = {
      None: { cardBg: "#fff7ed", accent: "#f97316", badgeBg: "#ffedd5", badgeText: "#9a3412", ring: "#fdba74" },
      Silver: { cardBg: "#fff7ed", accent: "#fb923c", badgeBg: "#ffedd5", badgeText: "#9a3412", ring: "#fdba74" },
      Gold: { cardBg: "#fff7ed", accent: "#f97316", badgeBg: "#ffedd5", badgeText: "#9a3412", ring: "#fdba74" },
      Platinum: { cardBg: "#fff7ed", accent: "#f97316", badgeBg: "#ffedd5", badgeText: "#9a3412", ring: "#fdba74" },
      Diamond: { cardBg: "#fff7ed", accent: "#f97316", badgeBg: "#ffedd5", badgeText: "#9a3412", ring: "#fdba74" },
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
    <BottomSheetModalProvider>
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
                  <Entypo name="info-with-circle" size={18} color={palette.muted} />
                </View>
                <View style={[styles.levelPill, { backgroundColor: membershipTone.badgeBg, borderColor: membershipTone.ring }]}>
                  <Feather name="award" size={14} color={membershipTone.badgeText} />
                  <Text style={[styles.levelPillText, { color: membershipTone.badgeText }]}>
                    {membershipLevel === "None" ? (t("standard") ?? "Standard") : membershipLevel}
                  </Text>
                </View>
              </View>
              <Text style={styles.walletValue}>{balance.toLocaleString()} SYP</Text>
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
                {remaining > 0 &&<Text style={styles.walletMiniLabel}>{t("remainingToNext") ?? "Remaining to"}</Text>}
                <Text style={styles.walletMiniValue}>
                  {remaining > 0 ? `${remaining.toLocaleString()} SYP (${nextLabel})` : t("congrats") ?? "Top level"}
                </Text>
              {/* </View> */}
            </View>
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Button title={t("topUp")} onPress={() => topupSheetRef.current?.present()} />
        </View>

        <Text style={[styles.cardTitle, { marginBottom: 8 }]}>{t("walletLedger") ?? "Wallet ledger"}</Text>
        <FlatList
          data={transactions}
          keyExtractor={(_, idx) => String(idx)}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          renderItem={({ item }: any) => (
            <View style={styles.txRow}>
              <View>
                <Text style={styles.txAmount}>{(item.amount || 0).toLocaleString()} SYP</Text>
                <Text style={styles.txMeta}>{item.type || item.source || "-"}</Text>
                {item.balanceAfter !== undefined && (
                  <Text style={styles.txMeta}>{t("balance")}: {item.balanceAfter.toLocaleString()} SYP</Text>
                )}
              </View>
              <Text style={[styles.txMeta, { textAlign: "right" }]}>
                {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.muted}>{t("noTransactions") ?? "No transactions yet"}</Text>}
        />
      </Screen>

      <BottomSheetModal
        ref={topupSheetRef}
        snapPoints={["55%", "70%"]}
        enablePanDownToClose
        keyboardBehavior={Platform.select({ ios: "interactive", default: "extend" })}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: palette.card, borderRadius: 20 }}
        handleIndicatorStyle={{ backgroundColor: palette.muted }}
      >
        <BottomSheetView style={{ flex: 1, padding: 16 }}>
          <Text style={styles.sheetTitle}>{t("topUpRequest")}</Text>
          <View style={{ flex: 1, gap: 12 }}>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder={t("amount")}
              placeholderTextColor={palette.muted}
            />
            <View style={[styles.row, { marginTop: 4 }]}>
              {["CASH_STORE", "SHAM_CASH", "BANK_TRANSFER"].map((m) => (
                <TouchableOpacity key={m} style={[styles.pill, method === m && styles.pillActive]} onPress={() => setMethod(m)}>
                  <Text style={styles.pillText}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ paddingTop: 12, borderTopWidth: 1, borderColor: palette.border }}>
            <Button title={t("submit")} onPress={submit} disabled={topupSubmitting} />
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    </BottomSheetModalProvider>
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
      marginBottom: 12,
      gap: 8,
    },
    balance: { color: palette.text, fontSize: 32, fontWeight: "800" },
    muted: { color: palette.muted },
    cardTitle: { color: palette.text, fontSize: 18, fontWeight: "700" },
    input: {
      backgroundColor: palette.surface,
      color: palette.text,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    row: { flexDirection: "row", gap: 8 },
    pill: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: palette.border },
    pillText: { color: palette.text, fontWeight: "700" },
    pillActive: { backgroundColor: palette.accent, borderColor: palette.accent },
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
    walletLabel: { color: palette.text, fontSize: 18, fontWeight: "700", textAlign: isRTL ? "right" : "left" },
    walletValue: { color: palette.text, fontSize: 28, fontWeight: "900", textAlign: isRTL ? "right" : "left" },
    walletFooterRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
    walletMiniLabel: { color: palette.muted, fontWeight: "700", fontSize: 12 },
    walletMiniValue: { color: palette.text, fontWeight: "800", fontSize: 14 },
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
      alignItems: "center",
    },
    txAmount: { color: palette.text, fontWeight: "800" },
    txMeta: { color: palette.muted, fontSize: 12 },
    sheetTitle: { color: palette.text, fontSize: 18, fontWeight: "800", marginBottom: 12 },
  });
