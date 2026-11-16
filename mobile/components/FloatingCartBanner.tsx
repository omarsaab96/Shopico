import { StyleSheet, TouchableOpacity, View } from "react-native";
import Text from "./Text";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import Money from "../components/Money";
import type { Currency } from "../lib/currency";

export default function FloatingCartBanner({ count, subtotal, currency, onPress, bottom = 10, horizontalInset = 0 }: {
  count: number; subtotal: number; currency?: Currency; onPress: () => void; bottom?: number; horizontalInset?: number;
}) {
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();
  if (count <= 0) return null;
  return <TouchableOpacity accessibilityRole="button" style={[styles.banner, {
    left: horizontalInset, right: horizontalInset, bottom, backgroundColor: palette.accent,
    paddingBottom: isRTL ? 6 : 8, shadowOpacity: isDark ? 0.18 : 0.08, elevation: isDark ? 2 : 1,
  }]} activeOpacity={0.9} onPress={onPress}>
    <View style={styles.side}>
      <View style={styles.count}>
        <Text weight="black" style={[styles.countText, { transform: [{ translateY: isRTL ? 2 : 0 }] }]}>
          {count}
        </Text>
      </View>
    </View>
    <Text weight="black" style={styles.title} numberOfLines={1}>{t("viewYourCart") ?? "View your cart"}</Text>
    <Money weight="black" style={styles.subtotal} amount={subtotal} currency={currency} />
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute", flexDirection: "row", justifyContent: "space-between", gap: 12,
    paddingHorizontal: 10, paddingVertical: 14, paddingTop: 8, borderRadius: 14, alignItems: "center",
    shadowColor: "#000", shadowRadius: 18, shadowOffset: { width: 0, height: 10 }
  },
  side: { },
  count: { minWidth: 28, height: 28, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#fff", opacity: 0.8,paddingHorizontal:5 },
  countText: { color: "#fff", fontSize: 14, lineHeight: 18 },
  title: { flex: 1, color: "#fff", fontSize: 14, textAlign: "center", lineHeight: 18 },
  subtotal: { color: "#fff", fontSize: 14, textAlign: "right", opacity: 0.8, lineHeight: 18 },
});
