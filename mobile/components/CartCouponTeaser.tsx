import Feather from "@expo/vector-icons/Feather";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Text from "./Text";
import api from "../lib/api";
import type { CartItem } from "../lib/cart";
import { closestCartCoupon, type CartCouponOffer } from "../lib/cartCouponTeaser";
import { useCurrency } from "../lib/currency";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";

export default function CartCouponTeaser({ items, subtotal, active, userId }: {
  items: CartItem[]; subtotal: number; active: boolean; userId?: string;
}) {
  const { selectedCurrency, formatMoney } = useCurrency();
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();
  const [offer, setOffer] = useState<CartCouponOffer | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOffer(null);
    const eligibleItems = items.filter(item => !item.unavailable);
    if (!active || !userId || !selectedCurrency?._id || !eligibleItems.length) return;
    // Avoid a request for every tap while the user is changing quantities.
    const timer = setTimeout(() => {
      void api.post("/coupons/available", {
        items: eligibleItems.map(({ productId, variantId, unit, quantity }) => ({ productId, variantId, unit: unit || "piece", quantity })),
        subtotal, deliveryFee: 0, currencyId: selectedCurrency._id,
      }).then(response => {
        if (!cancelled) setOffer(closestCartCoupon(response.data.data || []));
      }).catch(() => { if (!cancelled) setOffer(null); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [items, subtotal, active, userId, selectedCurrency?._id]);

  if (!active || !userId || !offer) return null;
  const message = t(offer.requiresEligibleProducts ? "cartCouponTeaserProducts" : "cartCouponTeaser")
    .replace("{amount}", `\u2068${formatMoney(offer.amountToUnlock, selectedCurrency)}\u2069`)
    .replace("{discount}", `\u2068${formatMoney(offer.discount, selectedCurrency)}\u2069`);

  return (
    <View style={[styles.card, { backgroundColor: isDark ? palette.card : "#fff7ed", borderColor: palette.border }]}>
      <Feather name="gift" size={20} color={palette.accent} />
      <View style={styles.content}>
        <Text weight="bold" style={{ color: palette.text, fontSize: 13, lineHeight: 21, textAlign: isRTL ? "right" : "left" }}>{message}</Text>
        <Text style={{ color: palette.muted, fontSize: 11, lineHeight: 17, textAlign: isRTL ? "right" : "left" }}>{offer.code}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 12 },
  content: { flex: 1, gap: 2 },
});
