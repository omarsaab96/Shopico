import Feather from "@expo/vector-icons/Feather";
import { DeviceEventEmitter } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Alert, Animated, Easing, AccessibilityInfo } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Screen from "../components/Screen";
import Text from "../components/Text";
import api from "../lib/api";
import UserCouponsDrawer, { couponValue, type PersonalCoupon } from "../components/UserCouponsDrawer";
import { useCurrency } from "../lib/currency";
import { useCart } from "../lib/cart";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import AntDesign from "@expo/vector-icons/AntDesign";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Canvas,
  Path,
  Skia,
  SweepGradient,
  vec,
} from "@shopify/react-native-skia";

const SIZE = 200;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;

export default function PointsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();

  const { selectedCurrency, setSelectedCurrencyId } = useCurrency();
  const { items } = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addedCoupon, setAddedCoupon] = useState<PersonalCoupon | null>(null);
  const [couponCount, setCouponCount] = useState(0);
  const [flight, setFlight] = useState<{ x: number; y: number; targetX: number; targetY: number } | null>(null);
  const root = useRef<View>(null);
  const couponTarget = useRef<View>(null);
  const couponSource = useRef<View>(null);
  const flightProgress = useRef(new Animated.Value(0)).current;
  const redeemRequestId = useRef<string | null>(null);
  const [rewardAvailable, setRewardAvailable] = useState(false);
  const [applyingReward, setApplyingReward] = useState(false);
  const [points, setPoints] = useState(0);
  const [threshold, setThreshold] = useState(100);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    api.get("/points").then((res) => {
      if (cancelled) return;
      setRewardAvailable(Boolean(res.data.data.rewardAvailable));
      setPoints(res.data.data.points || 0);
      setThreshold(res.data.data.rewardThreshold || 100);
    }).catch(() => { if (!cancelled) setRewardAvailable(false); });
    api.get("/points/coupons").then(res => {
      if (!cancelled) setCouponCount((res.data.data || []).length);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []));

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("shopico:notification", () => {
      void api.get("/points").then(res => { setRewardAvailable(Boolean(res.data.data.rewardAvailable)); setPoints(res.data.data.points || 0); setThreshold(res.data.data.rewardThreshold || 100); }).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  const animateCoupon = async (coupon: PersonalCoupon) => {
    const measure = (view: View | null) => new Promise<{ x: number; y: number; width: number; height: number }>(resolve => {
      if (!view) return resolve({ x: 0, y: 0, width: 0, height: 0 });
      view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
    });
    const [container, source, target] = await Promise.all([measure(root.current), measure(couponSource.current), measure(couponTarget.current)]);
    flightProgress.setValue(0);
    setAddedCoupon(coupon);
    setFlight({ x: source.x - container.x + source.width / 2 - 100, y: source.y - container.y,
      targetX: target.x - container.x + target.width / 2 - 100, targetY: target.y - container.y + target.height / 2 - 44 });
    const reducedMotion = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
    await new Promise<void>(resolve => Animated.timing(flightProgress, {
      toValue: 1, duration: reducedMotion ? 0 : 850, easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
    }).start(() => resolve()));
    setFlight(null);
    setCouponCount(count => count + 1);
    AccessibilityInfo.announceForAccessibility(t("couponAdded"));
    setDrawerOpen(true);
  };

  const applyReward = async () => {
    if (applyingReward) return;
    setApplyingReward(true);
    redeemRequestId.current ||= `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    try {
      const res = await api.post("/points/redeem", { requestId: redeemRequestId.current, currencyId: selectedCurrency?._id });
      redeemRequestId.current = null;
      await animateCoupon(res.data.data);
      void api.get("/points").then(response => setRewardAvailable(Boolean(response.data.data.rewardAvailable))).catch(() => {});
    } catch (error: any) {
      Alert.alert(t("usePoints"), error?.response?.data?.message || t("rewardApplyFailed"));
    } finally {
      setApplyingReward(false);
    }
  };


  const progress = Math.min(1, points / threshold);
  const remaining = Math.max(0, threshold - points);

  const styles = useMemo(() => createStyles(palette, isRTL, insets), [palette, isRTL]);

  // Arc path (starts from TOP)
  const arcPath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addArc(
      {
        x: STROKE / 2,
        y: STROKE / 2,
        width: SIZE - STROKE,
        height: SIZE - STROKE,
      },
      -90, // start at top
      progress * 360
    );
    return path;
  }, [progress]);

  return (
    <Screen>
      <View ref={root} style={{ flex: 1 }} collapsable={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} accessibilityRole="button"
          accessibilityLabel={isRTL ? "\u0631\u062c\u0648\u0639" : "Back"}
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile")} activeOpacity={0.85}>
          <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={21} color={palette.text} />
        </TouchableOpacity>
        <Text weight="bold" style={styles.title}>{t("pointsBalance") ?? "Points balance"}</Text>
        <View ref={couponTarget} collapsable={false}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.backButton} accessibilityRole="button" accessibilityLabel={`${t("myCoupons")} (${couponCount})`}>
            <Feather name="archive" size={21} color={palette.text} />
            {couponCount > 0 && <View style={styles.couponBadge}><Text style={{ color: "#fff", fontSize: 10 }}>{couponCount}</Text></View>}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        {/* RING */}
        <View style={styles.ringWrap}>
          <Canvas style={{ width: SIZE, height: SIZE }}>
            {/* Track */}
            <Path
              path={Skia.Path.Make().addCircle(CENTER, CENTER, RADIUS)}
              color="#ffe7d2"
              style="stroke"
              strokeWidth={STROKE}
            />

            {/* Progress */}
            <Path
              path={arcPath}
              style="stroke"
              strokeWidth={STROKE}
              strokeCap="round"
            >
              <SweepGradient
                c={vec(CENTER, CENTER)}
                colors={["#f97316", "#fb923c"]}
              />
            </Path>
          </Canvas>

          {/* Center */}
          <View style={styles.center}>
            <Text weight="black" style={styles.points}>{points}</Text>
            <Text weight="bold" style={styles.pointsLabel}>{t("rewards") ?? "Points"}</Text>
          </View>
        </View>

        {/* Gift */}
        <View ref={couponSource} collapsable={false} style={styles.giftWrap}>
          <View style={styles.giftIcon}>
            <AntDesign name="gift" size={36} color="#f97316" />
          </View>
          <Text weight="bold" style={styles.remaining}>
            {remaining.toLocaleString()}{" "}
            {t("pointsLeft") ?? "points left to unlock a reward"}
          </Text>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.cta, (!rewardAvailable || applyingReward) && { opacity: 0.5 }]}
          onPress={applyReward}
          disabled={!rewardAvailable || applyingReward}
          accessibilityRole="button"
        >
          <Text weight="bold" style={styles.ctaText}>
            {t("usePoints") ?? "Use points reward"}
          </Text>
        </TouchableOpacity>
      </View>
      {flight && addedCoupon && (
        <Animated.View pointerEvents="none" style={[styles.flyingCoupon, {
          backgroundColor: palette.card, borderColor: palette.accent,
          opacity: flightProgress.interpolate({ inputRange: [0, 0.12, 0.85, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: flightProgress.interpolate({ inputRange: [0, 1], outputRange: [flight.x, flight.targetX] }) },
            { translateY: flightProgress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [flight.y, flight.y - 45, flight.targetY] }) },
            { scale: flightProgress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.85, 1.05, 0.22] }) },
          ],
        }]}>
          <Feather name="gift" size={22} color={palette.accent} />
          <Text weight="black" style={{ color: palette.text, fontSize: 20 }}>{couponValue(addedCoupon, isRTL)}</Text>
          <Text style={{ color: palette.muted, fontSize: 12 }}>{t("pointsRewardDiscount")}</Text>
        </Animated.View>
      )}
      <UserCouponsDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} addedCoupon={addedCoupon}
        onSelect={coupon => {
          if (coupon.currency?._id) setSelectedCurrencyId(coupon.currency._id);
          setDrawerOpen(false);
          if (items.some(item => !item.unavailable)) {
            router.push({ pathname: "/(tabs)/cart", params: { checkout: "coupon", couponCode: coupon.code } });
          } else {
            router.push("/(tabs)/cart");
          }
        }} />
      </View>
    </Screen>
  );
}

/* ================= STYLES ================= */

const createStyles = (palette: any, isRTL: boolean, insets: any) =>
  StyleSheet.create({
    flyingCoupon: { position: "absolute", left: 0, top: 0, width: 200, height: 88, borderRadius: 16, borderWidth: 1,
      borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 3, zIndex: 20, elevation: 10 },
    couponBadge: { position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
      backgroundColor: palette.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
    header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
    backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: palette.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.border },
    title: {
      flex: 1,
      fontSize: 22,
      color: palette.text,
      textAlign: isRTL ? "right" : "left",
    },

    card: {
      borderRadius: 26,
      padding: 20,
      alignItems: "center",
      flex: 1,
      marginBottom: insets.bottom,
      justifyContent:'space-between'
    },

    ringWrap: {
      width: SIZE,
      height: SIZE,
      alignItems: "center",
      justifyContent: "center",
    },

    center: {
      position: "absolute",
      width: SIZE - STROKE * 2,
      height: SIZE - STROKE * 2,
      borderRadius: (SIZE - STROKE * 2) / 2,
      backgroundColor: palette.card,
      alignItems: "center",
      justifyContent: "center",
    },

    points: {
      fontSize: 36,
      color: palette.text,
    },

    pointsLabel: {
      fontSize: 14,
      color: palette.muted,
    },

    giftWrap: {
      alignItems: "center",
      gap: 10,
      marginTop: 14,
    },

    giftIcon: {
      width: 80,
      height: 80,
      borderRadius: 20,
      backgroundColor: "#fff3e8",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },

    remaining: {
      fontSize: 14,
      textAlign: "center",
      color: palette.text,
    },

    cta: {
      marginTop: 16,
      width: "100%",
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: "#f97316",
      alignItems: "center",
      shadowColor: "#f97316",
      shadowOpacity: 0.3,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 3,
    },

    ctaText: {
      color: "#fff",
      fontSize: 15,
    },
  });
