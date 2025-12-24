import { Link } from "expo-router";
import { Text, View, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import Button from "../components/Button";
import Screen from "../components/Screen";
import { useCart } from "../lib/cart";
import { palette } from "../styles/theme";

export default function CartScreen() {
  const { items, removeItem, clear } = useCart();
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <Screen>
      <Text style={styles.title}>Your cart</Text>
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
        <Text style={styles.totalLabel}>Subtotal</Text>
        <Text style={styles.totalValue}>{subtotal.toLocaleString()} SYP</Text>
      </View>
      <View style={{ gap: 8 }}>
        <Link href="/checkout" asChild>
          <Button title="Checkout" onPress={() => {}} />
        </Link>
        <Button title="Clear cart" onPress={clear} secondary />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12 },
  row: {
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
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
