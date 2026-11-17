import { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, TouchableOpacity, useWindowDimensions, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import * as Clipboard from "expo-clipboard";
import { type Currency } from "../lib/currency";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import Money from "./Money";
import Text from "./Text";

const WALLET_ADDRESS = "414ba0494cedd5ddc2d86d05ce21f3de";

export default function ShamCashPaymentStep({ amount, currency, busy, error, onCancel, onPaid }: {
  amount: number; currency?: Currency; busy: boolean; error: string | null; onCancel: () => void; onPaid: () => void;
}) {
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const { width } = useWindowDimensions();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const qrWidth = Math.min(200, width - 80);

  async function copyAddress() {
    try {
      await Clipboard.setStringAsync(WALLET_ADDRESS);
      setCopied(true);
      setCopyError(false);
      setTimeout(()=>{
        setCopied(false);
      },2000)
    } catch { setCopyError(true); }
  }

  return <View style={styles.content}>
    <View style={styles.heading}>
      <Image source={require("../assets/shamcash.png")} style={{ width: 30, height: 34 }} resizeMode="contain" />
      <Text weight="bold" style={{ color: palette.text, fontSize: 22 }}>{t("shamCashPaymentTitle")}</Text>
    </View>
    <Text style={{ color: palette.muted, textAlign: "center", lineHeight: 22 }}>{t("shamCashPaymentInstructions")}</Text>
    <View style={[styles.amount, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={{ color: palette.muted }}>{t("shamCashAmountToPay")}</Text>
      <Money weight="bold" amount={amount} currency={currency} style={{ color: palette.text, fontSize: 24,lineHeight:30 }} />
    </View>
    <View style={styles.qr}>
      <Image source={require("../assets/shamcash-qr.png")} resizeMode="contain"
        accessibilityLabel={t("shamCashQrCode")} style={{ width: qrWidth, height: qrWidth }} />
    </View>
    <View style={{ justifyContent:'center',alignItems:'center',gap: 8 }}>
      {/* <Text weight="bold" style={{ color: palette.text, textAlign: isRTL ? "right" : "left" }}>{t("shamCashWalletAddress")}</Text> */}
      <TouchableOpacity onPress={() => void copyAddress()} accessibilityRole="button" accessibilityLabel={t("shamCashCopyAddress")}
        style={[styles.address, { backgroundColor:palette.surface, borderColor: palette.border }]}>
        <Feather name={copied ? "check" : "copy"} size={19} color={palette.accent} />
        <Text style={{ color: palette.text, fontSize: 16, fontWeight:500 }}>{WALLET_ADDRESS}</Text>
      </TouchableOpacity>

      {copyError && <Text accessibilityLiveRegion="polite" style={{ color: copyError ? "#ef4444" : palette.muted, fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
        {t("shamCashCopyFailed")}
      </Text>}
    </View>
    <Text style={{ color: palette.muted, fontSize: 12, lineHeight: 19, textAlign: isRTL ? "right" : "left" }}>{t("shamCashManualConfirmation")}</Text>
    {error && <Text accessibilityLiveRegion="polite" style={{ color: "#ef4444" }}>{error}</Text>}
    <View style={{ flexDirection: "row", gap: 10 }}>
      <TouchableOpacity onPress={onCancel} disabled={busy} accessibilityRole="button"
        style={[styles.button, { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, opacity: busy ? 0.5 : 1 }]}>
        <Text weight="bold" style={{ color: palette.text }}>{t("cancel")}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onPaid} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy, busy }}
        style={[styles.button, { backgroundColor: palette.accent, opacity: busy ? 0.5 : 1 }]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text weight="bold" style={{ color: "#fff" }}>{t("shamCashIPaid")}</Text>}
      </TouchableOpacity>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 10 },
  heading: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  amount: { borderWidth: 1, borderRadius: 14, padding: 5, alignItems: "center", gap: 0,marginBottom:20 },
  qr: { alignSelf: "center", backgroundColor: "#fff", padding: 0, borderRadius: 0,marginBottom:0},
  address: { borderWidth: 0, borderRadius: 5, padding: 5, flexDirection: "row", alignItems: "center", gap: 10, justifyContent: 'center',marginBottom:20 },
  button: { flex: 1, borderRadius: 14, minHeight: 48, padding: 12, alignItems: "center", justifyContent: "center" },
});
