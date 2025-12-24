import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, TextInput, View, StyleSheet } from "react-native";
import Button from "../components/Button";
import Screen from "../components/Screen";
import { useCart } from "../lib/cart";
import api from "../lib/api";
import { palette } from "../styles/theme";

const toRad = (deg: number) => (deg * Math.PI) / 180;
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
};

export default function Checkout() {
  const { items, clear } = useCart();
  const router = useRouter();
  const [address, setAddress] = useState("Damascus");
  const [lat, setLat] = useState(33.5138);
  const [lng, setLng] = useState(36.2765);
  const [paymentMethod, setPaymentMethod] = useState<"CASH_ON_DELIVERY" | "SHAM_CASH" | "BANK_TRANSFER" | "WALLET">(
    "WALLET"
  );
  const [useReward, setUseReward] = useState(true);
  const [settings, setSettings] = useState<any>();

  useEffect(() => {
    api.get("/settings").then((res) => setSettings(res.data.data));
  }, []);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const distanceKm = settings ? haversine(settings.storeLat, settings.storeLng, lat, lng) : 0;
  const deliveryFee =
    settings && distanceKm > settings.deliveryFreeKm
      ? Math.ceil(distanceKm - settings.deliveryFreeKm) * settings.deliveryRatePerKm
      : 0;

  const placeOrder = async () => {
    await api.post("/orders", {
      address,
      lat,
      lng,
      paymentMethod,
      useReward,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });
    clear();
    router.replace("/orders");
  };

  return (
    <Screen>
      <Text style={styles.title}>Checkout</Text>
      <View style={styles.card}>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Address" placeholderTextColor="#94a3b8" />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.half]}
            value={String(lat)}
            onChangeText={(t) => setLat(Number(t))}
            placeholder="Latitude"
            placeholderTextColor="#94a3b8"
          />
          <TextInput
            style={[styles.input, styles.half]}
            value={String(lng)}
            onChangeText={(t) => setLng(Number(t))}
            placeholder="Longitude"
            placeholderTextColor="#94a3b8"
          />
        </View>
        <View style={styles.row}>
          {["WALLET", "CASH_ON_DELIVERY", "SHAM_CASH", "BANK_TRANSFER"].map((method) => (
            <Text
              key={method}
              style={[styles.pill, paymentMethod === method && styles.pillActive]}
              onPress={() => setPaymentMethod(method as any)}
            >
              {method}
            </Text>
          ))}
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Use points reward</Text>
          <Text style={styles.link} onPress={() => setUseReward((v) => !v)}>
            {useReward ? "Yes" : "No"}
          </Text>
        </View>
        <View style={styles.summary}>
          <Text style={styles.muted}>Distance</Text>
          <Text style={styles.value}>{distanceKm} km</Text>
        </View>
        <View style={styles.summary}>
          <Text style={styles.muted}>Delivery fee</Text>
          <Text style={styles.value}>{deliveryFee.toLocaleString()} SYP</Text>
        </View>
        <View style={styles.summary}>
          <Text style={styles.total}>Total</Text>
          <Text style={styles.total}>{(subtotal + deliveryFee).toLocaleString()} SYP</Text>
        </View>
        <Button title="Place order" onPress={placeOrder} />
        {paymentMethod === "SHAM_CASH" && <Text style={styles.info}>Use SHAM cash ID 123456 and notify support.</Text>}
        {paymentMethod === "BANK_TRANSFER" && <Text style={styles.info}>Transfer to Bank account 001-002-003.</Text>}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12 },
  card: { backgroundColor: palette.card, padding: 16, borderRadius: 14, gap: 10, borderWidth: 1, borderColor: "#1f2937" },
  input: {
    backgroundColor: "#0b1220",
    color: palette.text,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  half: { flex: 1 },
  pill: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, color: palette.text, borderWidth: 1, borderColor: "#1f2937" },
  pillActive: { backgroundColor: palette.accent, color: "#0f172a", borderColor: palette.accent },
  summary: { flexDirection: "row", justifyContent: "space-between" },
  muted: { color: palette.muted },
  value: { color: palette.text },
  total: { color: palette.text, fontWeight: "800" },
  label: { color: palette.text, fontWeight: "700" },
  link: { color: palette.accent },
  info: { color: palette.muted },
});
