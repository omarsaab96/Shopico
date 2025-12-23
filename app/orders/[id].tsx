import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import Screen from "../../components/Screen";
import ProgressBar from "../../components/ProgressBar";
import { palette } from "../../styles/theme";
import api from "../../lib/api";

const steps = ["PENDING", "PROCESSING", "SHIPPING", "DELIVERED"];

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<any>();

  useEffect(() => {
    api.get(`/orders/${id}`).then((res) => setOrder(res.data.data));
  }, [id]);

  if (!order) return null;
  const stepIndex = steps.indexOf(order.status);

  return (
    <Screen>
      <Text style={styles.title}>Order #{order._id?.slice(-6)}</Text>
      <ProgressBar progress={(stepIndex + 1) / steps.length} />
      <View style={styles.card}>
        <Text style={styles.muted}>Timeline</Text>
        <Text style={styles.value}>{order.status}</Text>
        <Text style={styles.muted}>Delivery fee: {order.deliveryFee?.toLocaleString()} SYP</Text>
        <Text style={styles.muted}>Distance: {order.deliveryDistanceKm} km</Text>
        <Text style={styles.total}>Total: {order.total?.toLocaleString()} SYP</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.muted}>Items</Text>
        {order.items?.map((item: any) => (
          <View key={item.product} style={styles.row}>
            <Text style={styles.value}>{item.quantity} x {item.product?.name || item.product}</Text>
            <Text style={styles.value}>{item.price.toLocaleString()}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12 },
  card: { backgroundColor: palette.card, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#1f2937", marginTop: 12 },
  muted: { color: palette.muted },
  value: { color: palette.text, fontWeight: "700" },
  total: { color: palette.accent, fontSize: 16, fontWeight: "800", marginTop: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
});
