import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import CartCouponTeaser from "./CartCouponTeaser";
import { useCart } from "../lib/cart";
import { useCurrency } from "../lib/currency";
import { roundAmount } from "../lib/productUnits";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Text from "./Text";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import Money from "../components/Money";

export default function FloatingCartBanner({ bottom = 10, horizontalInset = 0, onOccupiedHeightChange }: {
  bottom?: number;
  horizontalInset?: number;
  onOccupiedHeightChange?: (height: number) => void;
}) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { items } = useCart();
  const { selectedCurrency } = useCurrency();
  const count = items.length;
  const subtotal = roundAmount(items.reduce((sum, item) => item.unavailable ? sum : sum + roundAmount(item.price * item.quantity), 0));
  const [bannerHeight, setBannerHeight] = useState(0);
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();
  const [teaserHeight, setTeaserHeight] = useState(0);
  useEffect(() => {
    onOccupiedHeightChange?.(count > 0 ? bannerHeight + teaserHeight + bottom + 16 : 0);
  }, [count, bannerHeight, teaserHeight, bottom, onOccupiedHeightChange]);

  if (count <= 0) return null;
  return <View onLayout={({ nativeEvent }) => setBannerHeight(nativeEvent.layout.height)} style={[styles.shell, {
      position: "absolute",
      left: horizontalInset, right: horizontalInset, bottom,
      shadowOpacity: isDark ? 0.18 : 0.08, elevation: isDark ? 2 : 1,
    }]}>

    <View style={styles.teaserPopup}
      onLayout={({ nativeEvent }) => {
        const height = nativeEvent.layout.height;
        setTeaserHeight(height);
      }}>
      <CartCouponTeaser floating active={isFocused} />
    </View>

    <View style={[styles.container, { backgroundColor: palette.accent }]}>
      <TouchableOpacity accessibilityRole="button" style={[styles.banner, {
        backgroundColor: palette.accent, paddingBottom: isRTL ? 6 : 8,
      }]} activeOpacity={0.9} onPress={() => router.push("/(tabs)/cart")}>
        <View style={styles.side}>
          <View style={styles.count}>
            <Text weight="black" style={[styles.countText, { transform: [{ translateY: isRTL ? 2 : 0 }] }]}>
              {count}
            </Text>
          </View>
        </View>
        <Text weight="black" style={styles.title} numberOfLines={1}>{t("viewYourCart") ?? "View your cart"}</Text>
        <Money weight="black" style={styles.subtotal} amount={subtotal} currency={selectedCurrency} />
      </TouchableOpacity>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  shell: { borderRadius: 14, shadowColor: "#000", shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  // The popup sits outside layout so its entrance cannot move the cart button.
  teaserPopup: { position: "absolute", bottom: "100%", left: 10, right: 10, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: "hidden" },
  container: { borderRadius: 14, overflow: "hidden" },
  banner: {
    flexDirection: "row", justifyContent: "space-between", gap: 12,
    paddingHorizontal: 10, paddingVertical: 14, paddingTop: 8, borderRadius: 14, alignItems: "center",
  },
  side: { },
  count: { minWidth: 28, height: 28, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#fff", opacity: 0.8,paddingHorizontal:5 },
  countText: { color: "#fff", fontSize: 14, lineHeight: 18 },
  title: { flex: 1, color: "#fff", fontSize: 14, textAlign: "center", lineHeight: 18 },
  subtotal: { color: "#fff", fontSize: 14, textAlign: "right", opacity: 0.8, lineHeight: 18 },
});
