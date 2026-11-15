import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";
import Feather from "@expo/vector-icons/Feather";
import { BottomSheetModal } from "./BottomSheetModal";
import Text from "./Text";
import api from "../lib/api";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import type { Currency } from "../lib/currency";

export type PersonalCoupon = {
  _id: string;
  code: string;
  title?: string;
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

export default function UserCouponsDrawer({ visible, onClose, onSelect, addedCoupon }: {
  visible: boolean;
  onClose: () => void;
  onSelect: (coupon: PersonalCoupon) => void;
  addedCoupon?: PersonalCoupon | null;
}) {
  const sheet = useRef<BottomSheetModal>(null);
  const [coupons, setCoupons] = useState<PersonalCoupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const snaps = useMemo(() => ["60%"], []);
  useEffect(() => {
    if (!visible) { sheet.current?.dismiss(); return; }
    let cancelled = false;
    sheet.current?.present();
    setLoading(true);
    setFailed(false);
    api.get("/points/coupons").then(res => {
      if (!cancelled) setCoupons(res.data.data || []);
    }).catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, addedCoupon?._id]);
  return (
    <BottomSheetModal ref={sheet} snapPoints={snaps} enableDynamicSizing={false} onDismiss={onClose}
      backgroundStyle={{ backgroundColor: palette.background }}
      handleIndicatorStyle={{ backgroundColor: palette.muted }}
      backdropComponent={props => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />}>
      <BottomSheetScrollView contentContainerStyle={[styles.content, { direction: isRTL ? "rtl" : "ltr" }]}>
        <View style={styles.heading}>
          <Text weight="black" style={{ color: palette.text, fontSize: 22, flex: 1 }}>{t("myCoupons")}</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t("close")} style={styles.close}>
            <Feather name="x" size={22} color={palette.text} />
          </TouchableOpacity>
        </View>
        {loading ? <ActivityIndicator color={palette.accent} /> : failed ? (
          <Text style={{ color: palette.muted }}>{t("couponsLoadFailed")}</Text>
        ) : coupons.length === 0 ? (
          <Text style={{ color: palette.muted }}>{t("noSavedCoupons")}</Text>
        ) : coupons.map(coupon => (
          <Animated.View key={coupon._id} entering={FadeInDown.duration(300).reduceMotion(ReduceMotion.System)}
            style={[styles.coupon, { backgroundColor: palette.card, borderColor: coupon._id === addedCoupon?._id ? palette.accent : palette.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Feather name="gift" size={26} color={palette.accent} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text weight="black" style={{ color: palette.text, fontSize: 22 }}>
                  {coupon.freeDelivery ? t("freeDelivery") : couponValue(coupon, isRTL)}
                </Text>
                <Text style={{ color: palette.text }}>{coupon.rewardToken ? t("pointsRewardDiscount") : coupon.title || t("coupons")}</Text>
                <Text style={{ color: palette.muted, fontSize: 12 }}>{coupon.usageType === "SINGLE" ? t("oneTimeCoupon") : t("coupons")}</Text>
              </View>
              {coupon._id === addedCoupon?._id && <Text style={{ color: palette.accent }}>{t("couponAdded")}</Text>}
            </View>
            <TouchableOpacity onPress={() => onSelect(coupon)} style={[styles.use, { backgroundColor: palette.accent }]} accessibilityRole="button">
              <Text weight="bold" style={{ color: "#fff" }}>{t("useCoupon")}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  heading: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  close: { padding: 8 },
  coupon: { borderRadius: 18, padding: 16, borderWidth: 1, borderStyle: "dashed", gap: 14 },
  use: { borderRadius: 12, paddingVertical: 12, alignItems: "center" },
});
