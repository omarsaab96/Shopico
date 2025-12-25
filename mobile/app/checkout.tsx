import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text, TextInput, View, StyleSheet } from "react-native";
import Button from "../components/Button";
import Screen from "../components/Screen";
import { useCart } from "../lib/cart";
import { useAuth } from "../lib/auth";
import api from "../lib/api";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

const toRad = (deg: number) => (deg * Math.PI) / 180;
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
};

export default function Checkout() {
  const { items, clear } = useCart();
  const router = useRouter();
  const { user } = useAuth();
  const [address, setAddress] = useState("Damascus");
  const [lat, setLat] = useState(33.5138);
  const [lng, setLng] = useState(36.2765);
  const [paymentMethod, setPaymentMethod] = useState<"CASH_ON_DELIVERY" | "SHAM_CASH" | "BANK_TRANSFER" | "WALLET">("WALLET");
  const [useReward, setUseReward] = useState(true);
  const [settings, setSettings] = useState<any>();
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  useEffect(() => {
    api.get("/settings").then((res) => setSettings(res.data.data));
  }, []);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const distanceKm = settings ? haversine(settings.storeLat, settings.storeLng, lat, lng) : 0;
  const deliveryFee =
    settings && distanceKm > settings.deliveryFreeKm ? Math.ceil(distanceKm - settings.deliveryFreeKm) * settings.deliveryRatePerKm : 0;

  const placeOrder = async () => {
    if (!user) {
      router.push("/auth/login");
      return;
    }
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
      <Text style={styles.title}>{t("checkout")}</Text>
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder={t("address")}
          placeholderTextColor={palette.muted}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.half]}
            value={String(lat)}
            onChangeText={(text) => setLat(Number(text))}
            placeholder={t("latitude")}
            placeholderTextColor={palette.muted}
          />
          <TextInput
            style={[styles.input, styles.half]}
            value={String(lng)}
            onChangeText={(text) => setLng(Number(text))}
            placeholder={t("longitude")}
            placeholderTextColor={palette.muted}
          />
        </View>
        <View style={styles.row}>
          {["CASH_ON_DELIVERY", "SHAM_CASH", "BANK_TRANSFER", "WALLET"].map((method) => (
            <Text
              key={method}
              style={[styles.pill, paymentMethod === method && styles.pillActive]}
              onPress={() => setPaymentMethod(method as any)}
            >
              {method}
            </Text>
          ))}
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.muted}>{t("usePoints")}</Text>
          <Text style={[styles.pill, useReward && styles.pillActive]} onPress={() => setUseReward(!useReward)}>
            {useReward ? t("yes") : t("no")}
          </Text>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.muted}>
          {t("distance")}: {distanceKm} km
        </Text>
        <Text style={styles.muted}>
          {t("deliveryFee")}: {deliveryFee?.toLocaleString()} SYP
        </Text>
        <Text style={styles.muted}>
          {t("total")}: {(subtotal + deliveryFee).toLocaleString()} SYP
        </Text>
      </View>
      <Button title={t("placeOrder")} onPress={placeOrder} />
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12, textAlign: isRTL ? "right" : "left" },
    card: {
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
      gap: 10,
      marginBottom: 12,
    },
    input: {
      backgroundColor: palette.surface,
      color: palette.text,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    row: { flexDirection: "row", gap: 8 },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    half: { flex: 1 },
    pill: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, color: palette.text, borderWidth: 1, borderColor: palette.border },
    pillActive: { backgroundColor: palette.accent, color: "#0f172a", borderColor: palette.accent },
    muted: { color: palette.muted },
  });
