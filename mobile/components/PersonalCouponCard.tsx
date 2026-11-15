import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Alert, StyleSheet, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import Feather from "@expo/vector-icons/Feather";
import Text from "./Text";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import type { Currency } from "../lib/currency";

export type PersonalCoupon = {
  _id: string;
  code: string;
  title?: string;
  description?: string;
  expiresAt?: string;
  assignedProductName?: string;
  maxUses?: number;
  maxUsesScope?: string;
  maxUsesPerUser?: number;
  maxUsesGlobal?: number;
  usedCount?: number;
  userUsedCount?: number;
  rewardToken?: string;
  discountType: "FIXED" | "PERCENT";
  discountValue: number;
  freeDelivery: boolean;
  usageType: string;
  currency?: Currency;
};

export function couponValue(coupon: PersonalCoupon, isRTL: boolean) {
  if (coupon.discountType === "PERCENT") return `${coupon.discountValue}%`;
  const symbol = isRTL ? coupon.currency?.symbol.ar || coupon.currency?.symbol.en : coupon.currency?.symbol.en;
  return `${coupon.discountValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol || ""}`.trim();
}

export default function PersonalCouponCard({ coupon, onUse, isNew = false, disabled = false }: {
  coupon: PersonalCoupon; onUse: () => void; isNew?: boolean; disabled?: boolean;
}) {
  const { palette, isDark } = useTheme();
  const { t, isRTL, lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copiedTimer.current) clearTimeout(copiedTimer.current); }, []);
  const copyCode = async () => {
    try {
      const success = await Clipboard.setStringAsync(coupon.code);
      if (success === false) throw new Error("Copy failed");
      setCopied(true);
      AccessibilityInfo.announceForAccessibility(t("couponCodeCopied"));
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert(t("copyCouponCode"), t("copyCouponCodeFailed"));
    }
  };
  const perUserLimit = coupon.maxUsesPerUser ?? (coupon.maxUsesScope !== "GLOBAL" ? coupon.maxUses : undefined);
  const globalLimit = coupon.maxUsesGlobal ?? (coupon.maxUsesScope === "GLOBAL" ? coupon.maxUses : undefined);
  const usesLeft = coupon.usageType === "SINGLE" ? 1 : Math.min(
    perUserLimit === undefined ? Infinity : Math.max(0, perUserLimit - (coupon.userUsedCount || 0)),
    globalLimit === undefined ? Infinity : Math.max(0, globalLimit - (coupon.usedCount || 0)),
  );
  return (
    <View style={[styles.ticket, { backgroundColor: palette.card, borderColor: isNew ? palette.accent : palette.border }]}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: isDark ? palette.surface : "#fff0e3" }]}>
          <Feather name="gift" size={26} color={palette.accent} />
        </View>
        <View style={{ flex: 1, gap: 0 }}>
          <Text weight="bold" style={{ color: palette.accent, fontSize: 12,lineHeight:14 }}>
            {coupon.freeDelivery ? t("freeDelivery") : t("discount")}{coupon.assignedProductName ? ` · ${coupon.assignedProductName}` : ""}
          </Text>
          <Text weight="black" style={{ color: palette.text, fontSize: 25,lineHeight:38 }} numberOfLines={1} adjustsFontSizeToFit>
            {coupon.freeDelivery ? t("freeDelivery") : `${couponValue(coupon, isRTL)}${coupon.discountType === "PERCENT" ? ` ${t("off")}` : ""}`}
          </Text>
          
          {(coupon.rewardToken || coupon.title) && <Text style={{ color: palette.muted, fontSize: 12 }}>{coupon.rewardToken ? t("pointsRewardDiscount") : coupon.title}</Text>}
        </View>
        {isNew && <View style={[styles.badge, { backgroundColor: isDark ? palette.surface : "#fff0e3" }]}>
          <Text weight="bold" style={{ color: palette.accent, fontSize: 11 }}>{t("couponAdded")}</Text>
        </View>}
      </View>
      <View style={{ gap: 6, paddingBottom: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: palette.text, fontSize: 12, flexShrink: 1 }}>{t("couponCode")}: {coupon.code}</Text>
          <TouchableOpacity onPress={copyCode} accessibilityRole="button"
            accessibilityLabel={t(copied ? "couponCodeCopied" : "copyCouponCode")}
            hitSlop={8} style={{ padding: 6 }}>
            <Feather name={copied ? "check" : "copy"} size={16} color={palette.accent} />
          </TouchableOpacity>
        </View>
        {coupon.description && <Text style={{ color: palette.muted, fontSize: 12 }}>{coupon.description}</Text>}
        {coupon.expiresAt && <Text style={{ color: palette.muted, fontSize: 12 }}>
          {t("couponExpires")}: {new Date(coupon.expiresAt).toLocaleDateString(lang === "ar" ? "ar" : "en-US")}
        </Text>}
      </View>
      <View style={[styles.perforation, { borderColor: palette.border }]}>
        <View style={[styles.notch, { left: -27, backgroundColor: palette.background, borderColor: palette.border }]} />
        <View style={[styles.notch, { right: -27, backgroundColor: palette.background, borderColor: palette.border }]} />
      </View>
      <View style={styles.bottom}>
        <Text style={{ color: palette.muted, fontSize: 11, flex: 1 }}>{coupon.usageType === "SINGLE" ? t("oneTimeCoupon") : Number.isFinite(usesLeft) ? `${t("couponUsesLeft")}: ${usesLeft}` : t("couponUnlimitedUses")}</Text>
        <TouchableOpacity onPress={onUse} disabled={disabled} style={[styles.use, { backgroundColor: palette.accent }, disabled && { opacity: 0.4 }]} accessibilityRole="button" accessibilityState={{ disabled }}>
          <Text weight="bold" style={{ color: "#fff", fontSize: 12 }}>{t(disabled ? "couponUnavailable" : "useCoupon")}</Text>
          <Feather name={isRTL ? "arrow-left" : "arrow-right"} size={15} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  ticket: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 16 },
  top: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 18 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  badge: { borderRadius: 20, paddingVertical: 5, paddingHorizontal: 8 },
  perforation: { borderTopWidth: 1, borderStyle: "dashed", position: "relative" },
  notch: { position: "absolute", top: -11, width: 20, height: 20, borderRadius: 10, borderWidth: 1 },
  bottom: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  use: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
});
