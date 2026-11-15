import Feather from "@expo/vector-icons/Feather";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, AppState, DeviceEventEmitter, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { Keyframe, LinearTransition, ReduceMotion } from "react-native-reanimated";
import { useFocusEffect, useRouter } from "expo-router";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import Screen from "../components/Screen";
import Text from "../components/Text";
import PersonalCouponCard, { type PersonalCoupon } from "../components/PersonalCouponCard";
import api from "../lib/api";
import { useCurrency } from "../lib/currency";
import { useCart } from "../lib/cart";
import { roundAmount } from "../lib/productUnits";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const SIZE = 112;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const couponJump = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -110 }, { scale: 0.7 }] },
  55: { opacity: 1, transform: [{ translateY: 9 }, { scale: 1.03 }] },
  80: { opacity: 1, transform: [{ translateY: -4 }, { scale: 0.99 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
}).duration(650).reduceMotion(ReduceMotion.System);

export default function PointsScreen() {
  const router = useRouter();
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();
  const { selectedCurrency, setSelectedCurrencyId } = useCurrency();
  const { items } = useCart();
  const scroll = useRef<ScrollView>(null);
  const redeemRequestId = useRef<string | null>(null);
  const [coupons, setCoupons] = useState<PersonalCoupon[]>([]);
  const [addedCouponId, setAddedCouponId] = useState<string | null>(null);
  const [rewardAvailable, setRewardAvailable] = useState(false);
  const [applyingReward, setApplyingReward] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [points, setPoints] = useState(0);
  const [threshold, setThreshold] = useState<number | null>(null);

  const applySummary = useCallback((summary: any) => {
    const nextThreshold = Number(summary.rewardThreshold);
    if (!Number.isInteger(nextThreshold) || nextThreshold <= 0) {
      throw new Error("Invalid reward threshold");
    }
    setPoints(summary.points || 0);
    setThreshold(nextThreshold);
    setRewardAvailable(Boolean(summary.rewardAvailable));
  }, []);

  const load = useCallback(async (active: () => boolean = () => true) => {
    try {
      const [summary, saved] = await Promise.allSettled([api.get("/points"), api.get("/points/coupons")]);
      if (!active()) return;
      if (saved.status === "fulfilled") setCoupons(saved.value.data.data || []);
      if (summary.status === "fulfilled") applySummary(summary.value.data.data);
      else {
        setThreshold(null);
        setRewardAvailable(false);
      }
      setLoadFailed(summary.status === "rejected" || saved.status === "rejected");
    } catch {
      if (active()) {
        setThreshold(null);
        setRewardAvailable(false);
        setLoadFailed(true);
      }
    } finally {
      if (active()) setLoading(false);
    }
  }, [applySummary]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load(() => active);
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") void load(() => active);
    });
    return () => { active = false; subscription.remove(); };
  }, [load]));
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("shopico:notification", () => { void load(); });
    return () => sub.remove();
  }, [load]);

  const redeem = async () => {
    if (applyingReward || !rewardAvailable) return;
    setApplyingReward(true);
    redeemRequestId.current ||= `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    try {
      const res = await api.post("/points/redeem", { requestId: redeemRequestId.current, currencyId: selectedCurrency?._id });
      const coupon: PersonalCoupon = res.data.data;
      redeemRequestId.current = null;
      const reducedMotion = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      scroll.current?.scrollTo({ y: 0, animated: !reducedMotion });
      setAddedCouponId(coupon._id);
      setCoupons(current => [coupon, ...current.filter(item => item._id !== coupon._id)]);
      AccessibilityInfo.announceForAccessibility(t("couponAdded"));
      // Keep the receipt visible even if the subsequent balance refresh fails.
      try {
        const summary = await api.get("/points");
        applySummary(summary.data.data);
      } catch { setRewardAvailable(false); }
    } catch (error: any) {
      Alert.alert(t("redeemPoints"), error?.response?.data?.message || t("rewardApplyFailed"));
    } finally {
      setApplyingReward(false);
    }
  };

  const progress = threshold === null ? 0 : rewardAvailable ? 1 : (points % threshold) / threshold;
  const remaining = threshold === null ? null : rewardAvailable ? 0 : threshold - (points % threshold);
  const arc = useMemo(() => {
    const path = Skia.Path.Make();
    path.addArc({ x: STROKE / 2, y: STROKE / 2, width: SIZE - STROKE, height: SIZE - STROKE }, -90, progress * 360);
    return path;
  }, [progress]);
  const cardBg = isDark ? palette.card : "#fff7ed";
  const styles = useMemo(() => createStyles(palette, isRTL, isDark), [palette, isRTL, isDark]);

  const cartSubtotal = roundAmount(items.reduce((sum, item) => item.unavailable ? sum : sum + item.price * item.quantity, 0));
  const couponTooLarge = (coupon: PersonalCoupon) => {
    if (coupon.freeDelivery || coupon.discountType !== "FIXED") return false;
    const rate = Number(coupon.currency?.exchangeRate || 1);
    return roundAmount(coupon.discountValue * (rate > 0 ? rate : 1)) > cartSubtotal;
  };
  const orderedCoupons = [...coupons].sort((a, b) => Number(couponTooLarge(a)) - Number(couponTooLarge(b)));
  const useCoupon = (coupon: PersonalCoupon) => {
    if (couponTooLarge(coupon)) return;
    if (coupon.currency?._id) setSelectedCurrencyId(coupon.currency._id);
    if (items.some(item => !item.unavailable)) {
      router.push({ pathname: "/(tabs)/cart", params: { checkout: "coupon", couponCode: coupon.code } });
    } else router.push("/(tabs)/cart");
  };

  return (
    <Screen>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} accessibilityRole="button" accessibilityLabel={isRTL ? "رجوع" : "Back"}
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile")}>
          <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={21} color={palette.text} />
        </TouchableOpacity>
        <Text weight="black" style={styles.title}>{t("pointsBalance")}</Text>
      </View>

      <ScrollView ref={scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={palette.accent} onRefresh={async () => {
          setRefreshing(true); await load(); setRefreshing(false);
        }} />}>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View pointerEvents="none" style={[styles.glowA, { backgroundColor: palette.accent }]} />
          <View pointerEvents="none" style={[styles.glowB, { backgroundColor: palette.accent }]} />
          <View style={styles.balanceRow}>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.labelRow}>
                {/* <Feather name="award" size={17} color={palette.accent} />
                <Text weight="bold" style={styles.label}>{t("pointsEarned")}</Text> */}
                <MaterialCommunityIcons name="star-four-points-circle" size={26} color={palette.accentSoft} />
                <Text weight="black" style={styles.balance} numberOfLines={1} adjustsFontSizeToFit>{points.toLocaleString()}</Text>
              </View>
              <Text style={styles.remaining}>
                <Text weight="black" style={{ color: palette.accent }}>{remaining === null ? "—" : `${remaining.toLocaleString()} `}</Text>
                {remaining !== null && t("pointsLeft")}
              </Text>
            </View>
            <View style={styles.ring} accessibilityRole="progressbar" accessibilityLabel={t("pointsBalance")}
              accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
              <Canvas style={{ width: SIZE, height: SIZE }}>
                <Path path={Skia.Path.Make().addCircle(CENTER, CENTER, RADIUS)} color={isDark ? palette.surface : "#ffdfc3"} style="stroke" strokeWidth={STROKE} />
                <Path path={arc} color={palette.accent} style="stroke" strokeWidth={STROKE} strokeCap="round" />
              </Canvas>
              <View pointerEvents="none" style={styles.ringCenter}>
                <Feather name={rewardAvailable ? "gift" : "award"} size={22} color={palette.accent} />
                <Text weight="black" style={{ color: palette.text, fontSize: 18 }}>{threshold === null ? "—" : `${Math.round(progress * 100)}%`}</Text>
              </View>
            </View>
          </View>
          {/* {rewardAvailable && <Text weight="bold" style={styles.ready}>{t("redeemAvailable")}</Text>} */}
          <TouchableOpacity onPress={redeem} disabled={loading || applyingReward || !rewardAvailable}
            style={[styles.redeem, (loading || applyingReward || !rewardAvailable) && { opacity: 0.5 }]} accessibilityRole="button">
            {applyingReward ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="gift" size={18} color="#fff" />}
            <Text weight="bold" style={{ color: "#fff", fontSize: 15 }}>{t("redeemPoints")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text weight="black" style={styles.sectionTitle}>{t("myCoupons")}</Text>
          <View style={styles.count}><Text weight="bold" style={{ color: palette.accent, fontSize: 12 }}>{coupons.length}</Text></View>
        </View>
        {loading ? <ActivityIndicator color={palette.accent} /> : loadFailed ? (
          <TouchableOpacity onPress={() => void load()} style={styles.empty} accessibilityRole="button">
            <Text style={styles.emptyText}>{t("couponsRefreshFailed")}</Text>
          </TouchableOpacity>
        ) : coupons.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="gift" size={28} color={palette.accent} />
            <Text style={styles.emptyText}>{t("noSavedCoupons")}</Text>
          </View>
        ) : null}
        {orderedCoupons.map(coupon => (
          <Animated.View key={coupon._id} entering={coupon._id === addedCouponId ? couponJump : undefined}
            layout={LinearTransition.duration(280).reduceMotion(ReduceMotion.System)}>
            <PersonalCouponCard coupon={coupon} disabled={couponTooLarge(coupon)} isNew={coupon._id === addedCouponId} onUse={() => useCoupon(coupon)} />
          </Animated.View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean, isDark: boolean) => StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: palette.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.border },
  title: { flex: 1, fontSize: 22, color: palette.text, textAlign: isRTL ? "right" : "left" },
  content: { paddingBottom: 32, gap: 14 },
  card: {
    borderRadius: 20, padding: 20, borderWidth: 1, borderColor: isDark ? palette.border : "rgba(15,23,42,0.08)", overflow: "hidden",
    shadowColor: "#000", shadowOpacity: isDark ? 0.18 : 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2
  },
  glowA: { position: "absolute", width: 140, height: 110, borderRadius: 999, opacity: isDark ? 0.08 : 0.14, top: -55, start: -55 },
  glowB: { position: "absolute", width: 140, height: 140, borderRadius: 999, opacity: isDark ? 0.06 : 0.12, bottom: -80, end: -70 },
  balanceRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { color: palette.text, fontSize: 14 },
  balance: { color: palette.text, fontSize: 38, lineHeight: 50 },
  remaining: { color: palette.muted, fontSize: 12, lineHeight: 20 },
  ring: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  ringCenter: { position: "absolute", alignItems: "center", justifyContent: "center", gap: 4 },
  ready: { color: palette.accent, fontSize: 12, marginTop: 12 },
  redeem: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: palette.accent, paddingVertical: 13, borderRadius: 13, marginTop: 18 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, marginBottom: 2 },
  sectionTitle: { color: palette.text, fontSize: 20 },
  count: { backgroundColor: isDark ? palette.surface : "#fff0e3", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  empty: { padding: 24, borderWidth: 1, borderStyle: "dashed", borderColor: palette.border, borderRadius: 18, gap: 12, alignItems: "center" },
  emptyText: { color: palette.muted, textAlign: "center", fontSize: 13 },
});
