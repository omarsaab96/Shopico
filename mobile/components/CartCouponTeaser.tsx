import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from "react-native-reanimated";
import Feather from "@expo/vector-icons/Feather";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Text from "./Text";
import { Shimmer } from "./Shimmer";
import { useAuth } from "../lib/auth";
import { useCartCoupon } from "../lib/cartCouponContext";
import { useCurrency } from "../lib/currency";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { Ionicons } from "@expo/vector-icons";
import Money from "../components/Money";

export default function CartCouponTeaser({ active, refreshing = false, floating = false }: {
  active: boolean; refreshing?: boolean; floating?: boolean;
}) {
  const { user } = useAuth();
  const userId = user?._id;
  const { selectedCurrency, formatMoney } = useCurrency();
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();
  const { offer, loading, presentation, refresh, hasPresented, markPresented } = useCartCoupon();
  const wasRefreshing = useRef(false);
  const [contentSize, setContentSize] = useState({ width: 150, height: 36 });
  const [footerWidth, setFooterWidth] = useState(200);

  useEffect(() => {
    if (wasRefreshing.current && !refreshing) refresh();
    wasRefreshing.current = refreshing;
  }, [refreshing, refresh]);

  const animatePopup = floating && active && Boolean(offer) && !hasPresented(presentation);
  useEffect(() => {
    if (floating && active && offer) markPresented(presentation);
  }, [floating, active, offer, presentation, markPresented]);

  // Keep an existing floating teaser mounted as screens blur during navigation.
  if ((!active && !floating) || !userId || (!offer && (!loading || floating))) return null;
  const progress = offer ? Math.max(0, Math.min(1, (offer.discount - offer.amountToUnlock) / offer.discount)) : 0;
  const message = offer ? t(offer.requiresEligibleProducts ? "cartCouponTeaserProducts" : "cartCouponTeaser")
    .replace("{amount}", `\u2068${formatMoney(offer.amountToUnlock, selectedCurrency)}\u2069`) : "";

  const discountLabel = offer ? `${t("discount")}: \u2068${formatMoney(offer.discount, selectedCurrency)}\u2069` : " ";

  return (
    <Animated.View entering={animatePopup ? FadeInDown.duration(300).reduceMotion(ReduceMotion.System) : undefined}
      exiting={floating && active ? FadeOutDown.duration(180).reduceMotion(ReduceMotion.System) : undefined}
      accessibilityState={{ busy: loading }} style={[styles.ticket, { backgroundColor: palette.card, borderColor: palette.border }, floating && styles.floating]}>
      <View style={styles.top}>
        {!floating && <View style={[styles.icon, { backgroundColor: isDark ? palette.surface : "#fff0e3" }]}>
          <Ionicons name="ticket-outline" size={18} color={palette.accent} />
        </View>}

        <View style={[styles.content, floating && styles.floatingContent]} onLayout={({ nativeEvent }) => {
          const { width, height } = nativeEvent.layout;
          setContentSize(current => current.width === width && current.height === height ? current : { width, height });
        }}>
          {floating ? (
            <View style={[styles.floatingHeading, { opacity: loading ? 0 : 1 }]}
              accessibilityElementsHidden={loading} importantForAccessibility={loading ? "no-hide-descendants" : "auto"}>
              <Text weight="bold" style={{ flex: 1, color: palette.text, fontSize: 12, lineHeight: 18, textAlign: isRTL ? "right" : "left" }}>
                {message || " "}
              </Text>

              <View style={styles.floatingValue}>
                <Ionicons name="ticket-outline" size={15} color={palette.accent} />
                {/* <Text weight="black" accessibilityLabel={discountLabel}
                  style={{ color: palette.accent, fontSize: 12, lineHeight: 18 }}>
                  {offer ? formatMoney(offer.discount, selectedCurrency) : " "}
                </Text> */}

                <Money style={{ fontWeight: "900", color: palette.accent, fontSize: 12, lineHeight: 18 }} amount={Number(offer?.discount)} currency={selectedCurrency} />
              </View>

            </View>
          ) : (
            <Text weight="bold" accessibilityElementsHidden={loading}
              importantForAccessibility={loading ? "no-hide-descendants" : "auto"}
              style={{ color: palette.text, fontSize: 12, lineHeight: 18, textAlign: isRTL ? "right" : "left", opacity: loading ? 0 : 1 }}>
              {message || " "}
            </Text>
          )}

          {!loading && <View accessibilityRole="progressbar" accessibilityLabel={message}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
            style={[styles.progressTrack, { backgroundColor: palette.border, alignItems: isRTL ? "flex-end" : "flex-start" }]}>
            <View style={[
              styles.progressFill,
              {
                backgroundColor: palette.accent,
                width: `${progress * 100}%`
              }
            ]} />
          </View>}

          {!floating && <Text weight="bold" accessibilityElementsHidden={loading}
            importantForAccessibility={loading ? "no-hide-descendants" : "auto"}
            style={{ color: palette.accent, fontSize: 11, lineHeight: 17, textAlign: isRTL ? "right" : "left", opacity: loading ? 0 : 1 }}>
            {discountLabel}
          </Text>}

          {loading && !floating && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { gap: 5 }]}>
            <Shimmer width={contentSize.width * 0.75} height={14} colorScheme={isDark ? "dark" : "light"} />
            {/* <Shimmer width={contentSize.width} height={7} colorScheme={isDark ? "dark" : "light"} /> */}
            <Shimmer width={contentSize.width * 0.15} height={14} colorScheme={isDark ? "dark" : "light"} />
          </View>}
          {loading && floating && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { gap: 0 }]}>
            <Shimmer width={contentSize.width} height={14} colorScheme={isDark ? "dark" : "light"} />
            {/* <Shimmer width={contentSize.width} height={7} colorScheme={isDark ? "dark" : "light"} /> */}
            {/* <Shimmer width={contentSize.width * 0.15} height={14} colorScheme={isDark ? "dark" : "light"} /> */}
          </View>}
        </View>

        {/* {!floating && <Feather name="lock" size={14} color={palette.muted} />} */}
      </View>

      {!floating && <>
        <View pointerEvents="none" style={[styles.perforation, { borderColor: palette.border }]}>
          <View style={[styles.notch, { left: -21, backgroundColor: palette.background, borderRightColor: palette.border, borderBottomColor: palette.border }]} />
          <View style={[styles.notch, { right: -21, backgroundColor: palette.background, borderLeftColor: palette.border, borderTopColor: palette.border }]} />
        </View>
        <View style={styles.tearOff} onLayout={({ nativeEvent }) => setFooterWidth(nativeEvent.layout.width)}>
          <View style={[styles.footerContent, { opacity: loading ? 0 : 1 }]}
            accessibilityElementsHidden={loading} importantForAccessibility={loading ? "no-hide-descendants" : "auto"}>
            <Text numberOfLines={1} style={{ color: palette.muted, fontSize: 10, lineHeight: 16, textAlign: isRTL ? "right" : "left" }}>
              {offer?.code || " "}
            </Text>

          </View>
          {loading && <View pointerEvents="none" style={styles.footerShimmer}>
            <Shimmer width={footerWidth} height={16} colorScheme={isDark ? "dark" : "light"} />
          </View>}
        </View>
      </>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ticket: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, marginBottom: 10 },
  floating: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderWidth: 1, borderBottomWidth:0,marginBottom: 0 },
  top: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  icon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  content: { flex: 1, gap: 2, minHeight: 36 },
  floatingContent: { minHeight: 0, gap: 5 },
  floatingHeading: { flexDirection: "row", direction: "ltr", alignItems: "center", gap: 5 },
  floatingValue: { flexDirection: "row", direction: "ltr", alignItems: "center", gap: 4, flexShrink: 0 },
  perforation: { borderTopWidth: 1, borderStyle: "dashed", position: "relative" },
  notch: { position: "absolute", top: -9, width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: 'transparent', transform: [{ rotateZ: "-45deg" }] },
  tearOff: { paddingVertical: 9 },
  footerContent: { flexDirection: "row", alignItems: "center", gap: 10 },
  footerShimmer: { position: "absolute", top: 9, left: 0, right: 0 },
  progressTrack: { borderRadius: 999, overflow: "hidden", direction: "ltr" },
  progressFill: { height: 4, borderRadius: 999 },
});
