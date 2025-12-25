import { Link } from "expo-router";
import { useMemo } from "react";
import { Text, View, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import Button from "../components/Button";
import Screen from "../components/Screen";
import { useCart } from "../lib/cart";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

export default function CartScreen() {
  const { items, removeItem, clear } = useCart();
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  return (
    <Screen>
      <Text style={styles.title}>{t("cart")}</Text>
      <FlatList
        data={items}
        keyExtractor={(i) => i.productId}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.muted}>
                {item.quantity} x {item.price.toLocaleString()}
              </Text>
            </View>
            <TouchableOpacity onPress={() => removeItem(item.productId)}>
              <Text style={styles.link}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      />
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{t("subtotal")}</Text>
        <Text style={styles.totalValue}>{subtotal.toLocaleString()} SYP</Text>
      </View>
      <View style={{ gap: 8 }}>
        <Link href="/checkout" asChild>
          <Button title={t("checkout")} onPress={() => {}} />
        </Link>
        <Button title={t("clearCart")} onPress={clear} secondary />
      </View>
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12, textAlign: isRTL ? "right" : "left" },
    row: {
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    name: { color: palette.text, fontWeight: "700" },
    muted: { color: palette.muted },
    link: { color: palette.accent },
    totalRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 12 },
    totalLabel: { color: palette.muted },
    totalValue: { color: palette.text, fontWeight: "800" },
  });
