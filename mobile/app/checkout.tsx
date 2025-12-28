import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
import Button from "../components/Button";
import Screen from "../components/Screen";
import { useCart } from "../lib/cart";
import { useAuth } from "../lib/auth";
import api from "../lib/api";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

type SavedAddress = { _id: string; address: string; lat: number; lng: number; label: string; updatedAt?: string; createdAt?: string };

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
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selected, setSelected] = useState<SavedAddress | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH_ON_DELIVERY" | "SHAM_CASH" | "BANK_TRANSFER" | "WALLET">("WALLET");
  const [settings, setSettings] = useState<any>();
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  useEffect(() => {
    api.get("/settings").then((res) => setSettings(res.data.data));
  }, []);

  const loadAddresses = useCallback(() => {
    if (!user) return;
    api
      .get("/addresses")
      .then((res) => {
        const list: SavedAddress[] = res.data.data || [];
        const sorted = [...list].sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        });
        setAddresses(sorted);
        setSelected((prev) => {
          if (prev) {
            const match = sorted.find((a) => a._id === prev._id);
            if (match) return match;
          }
          return sorted[0] || null;
        });
      })
      .catch(() => {
        setAddresses([]);
        setSelected(null);
      });
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadAddresses();
    }, [loadAddresses])
  );

  useEffect(() => {
    if (!user) {
      router.replace("/auth/login");
    }
  }, [user, router]);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const lat = selected?.lat ?? 0;
  const lng = selected?.lng ?? 0;
  const distanceKm = settings && selected ? haversine(settings.storeLat, settings.storeLng, lat, lng) : 0;
  const deliveryFee =
    settings && selected && distanceKm > settings.deliveryFreeKm
      ? Math.ceil(distanceKm - settings.deliveryFreeKm) * settings.deliveryRatePerKm
      : 0;

  const placeOrder = async () => {
    if (!user) {
      router.push("/auth/login");
      return;
    }
    if (!selected) return;
    await api.post("/orders", {
      addressId: selected._id,
      paymentMethod,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });
    clear();
    router.replace("/(tabs)/orders");
  };

  return (
    <Screen>
      <Text style={styles.title}>{t("checkout")}</Text>
      <Text style={styles.section}>{t("address")}</Text>
      <View style={styles.card}>
        {selected ? (
          <View style={styles.addressBox}>
            <Text style={styles.addressLabel}>{selected.label}</Text>
            <Text style={styles.addressText}>{selected.address}</Text>
            {/* <Text style={styles.mutedSmall}>
              {t("latitude")}: {selected.lat} | {t("longitude")}: {selected.lng}
            </Text> */}
          </View>
        ) : (
          <Text style={styles.muted}>{t("noAddresses") ?? "No addresses saved yet."}</Text>
        )}
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push("/addresses")}>
          <Text style={styles.secondaryText}>{selected ? t("change") ?? "Change address" : t("addAddress") ?? "Add address"}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        <Text style={styles.section}>{t("paymentMethod") ?? "Payment"}</Text>
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
      </View>
      <View style={styles.card}>
        <Text style={styles.muted}>
          {t("distance")}: {distanceKm} km
        </Text>
        <Text style={styles.muted}>
          {t("deliveryFee")}: {deliveryFee==0 ? 'Free' : `${deliveryFee?.toLocaleString()} SYP` } 
        </Text>
        <Text style={styles.muted}>
          {t("total")}: {(subtotal + deliveryFee).toLocaleString()} SYP
        </Text>
      </View>
      <Button title={t("placeOrder")} onPress={placeOrder} disabled={!selected} />
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
    mutedSmall: { color: palette.muted, fontSize: 12 },
    section: { color: palette.text, fontWeight: "800" },
    addressBox: { gap: 4, marginBottom: 8 },
    addressLabel: { color: palette.text, fontWeight: "700" },
    addressText: { color: palette.text },
    secondaryBtn: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      alignItems: "center",
    },
    secondaryText: { color: palette.accent, fontWeight: "700" },
  });
