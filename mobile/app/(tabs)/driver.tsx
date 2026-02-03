import { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import * as Location from "expo-location";
import Screen from "../../components/Screen";
import Text from "../../components/Text";
import api from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";

type DriverOrder = {
  _id: string;
  status: string;
  address: string;
  total: number;
  deliveryDistanceKm?: number;
  branchId?: string;
  lat?: number;
  lng?: number;
};

export default function DriverOrders() {
  const { user } = useAuth();
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const trackingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [simulatingOrderId, setSimulatingOrderId] = useState<string | null>(null);
  const simulationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [branchMap, setBranchMap] = useState<Record<string, { lat: number; lng: number }>>({});

  const canDeliver = user?.role === "driver";

  const load = async () => {
    if (!canDeliver) return;
    setLoading(true);
    try {
      const res = await api.get("/orders/driver");
      setOrders(res.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api
      .get("/branches/public")
      .then((res) => {
        const list = res.data.data || [];
        const map: Record<string, { lat: number; lng: number }> = {};
        list.forEach((b: any) => {
          const lat = typeof b.lat === "string" ? Number(b.lat) : b.lat;
          const lng = typeof b.lng === "string" ? Number(b.lng) : b.lng;
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            map[b._id] = { lat, lng };
          }
        });
        setBranchMap(map);
      })
      .catch(() => setBranchMap({}));
    return () => {
      if (trackingRef.current) clearInterval(trackingRef.current);
      if (simulationRef.current) clearInterval(simulationRef.current);
    };
  }, []);

  const pushLocation = async (orderId: string) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("locationDenied") ?? "Location denied");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    await api.put(`/orders/${orderId}/driver-location`, {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    });
  };

  const startTracking = async (orderId: string) => {
    setUpdating((prev) => ({ ...prev, [orderId]: true }));
    try {
      await api.put(`/orders/${orderId}/driver-status`, { status: "SHIPPING" });
      await pushLocation(orderId);
      if (trackingRef.current) clearInterval(trackingRef.current);
      trackingRef.current = setInterval(() => {
        pushLocation(orderId).catch(() => {});
      }, 10000);
      setTrackingOrderId(orderId);
      await load();
    } finally {
      setUpdating((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const markDelivered = async (orderId: string) => {
    setUpdating((prev) => ({ ...prev, [orderId]: true }));
    try {
      await api.put(`/orders/${orderId}/driver-status`, { status: "DELIVERED" });
      if (trackingRef.current) clearInterval(trackingRef.current);
      trackingRef.current = null;
      setTrackingOrderId(null);
      await load();
    } finally {
      setUpdating((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const simulateRoute = async (order: DriverOrder) => {
    const orderLat = order.lat;
    const orderLng = order.lng;
    const branch = order.branchId ? branchMap[order.branchId] : null;
    if (!branch || orderLat === undefined || orderLng === undefined) {
      Alert.alert(t("routeUnavailable") ?? "Route unavailable", "Missing branch or destination coordinates.");
      return;
    }
    setUpdating((prev) => ({ ...prev, [order._id]: true }));
    try {
      await api.put(`/orders/${order._id}/driver-status`, { status: "SHIPPING" });
      if (simulationRef.current) clearInterval(simulationRef.current);
      setSimulatingOrderId(order._id);
      const steps = 30;
      let step = 0;
      simulationRef.current = setInterval(() => {
        if (step > steps) {
          if (simulationRef.current) clearInterval(simulationRef.current);
          simulationRef.current = null;
          setSimulatingOrderId(null);
          return;
        }
        const tRatio = step / steps;
        const lat = branch.lat + (orderLat - branch.lat) * tRatio;
        const lng = branch.lng + (orderLng - branch.lng) * tRatio;
        api.put(`/orders/${order._id}/driver-location`, { lat, lng }).catch(() => {});
        step += 1;
      }, 3000);
      await load();
    } finally {
      setUpdating((prev) => ({ ...prev, [order._id]: false }));
    }
  };

  if (!canDeliver) {
    return (
      <Screen>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>{t("noPermissionTitle") ?? "No access"}</Text>
          <Text style={styles.emptyText}>{t("noPermissionBody") ?? "You do not have permission to view this page."}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>{t("driver") ?? "Driver"}</Text>
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>{t("noOrders") ?? "No orders yet"}</Text>
          <Text style={styles.emptyText}>{t("driverNoOrders") ?? "No assigned deliveries right now."}</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
          renderItem={({ item }) => {
            const isShipping = item.status === "SHIPPING";
            const isTracking = trackingOrderId === item._id;
            const isSimulating = simulatingOrderId === item._id;
            return (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle}>#{item._id.slice(-6)}</Text>
                  <Text style={styles.status}>{item.status}</Text>
                </View>
                <Text style={styles.cardSub}>{item.address}</Text>
                <View style={styles.cardRow}>
                  <Text style={styles.cardMeta}>
                    {item.total?.toLocaleString()} {t("syp")}
                  </Text>
                  {item.deliveryDistanceKm !== undefined ? (
                    <Text style={styles.cardMeta}>
                      {item.deliveryDistanceKm} {t("km")}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.btnRow}>
                  {item.status === "PROCESSING" || item.status === "PENDING" ? (
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={() => startTracking(item._id)}
                      disabled={updating[item._id]}
                    >
                      <Text style={styles.primaryBtnText}>
                        {updating[item._id] ? (t("starting") ?? "Starting...") : (t("startDelivery") ?? "Start delivery")}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {isShipping ? (
                    <>
                      <TouchableOpacity
                        style={styles.ghostBtn}
                        onPress={() => pushLocation(item._id)}
                        disabled={updating[item._id]}
                      >
                        <Text style={styles.ghostBtnText}>
                          {isTracking ? (t("trackingOn") ?? "Tracking") : (t("updateLocation") ?? "Update location")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.simBtn}
                        onPress={() => simulateRoute(item)}
                        disabled={updating[item._id] || isSimulating}
                      >
                        <Text style={styles.simBtnText}>
                          {isSimulating ? (t("simulating") ?? "Simulating...") : (t("simulateRoute") ?? "Simulate route")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.dangerBtn}
                        onPress={() => markDelivered(item._id)}
                        disabled={updating[item._id]}
                      >
                        <Text style={styles.dangerBtnText}>
                          {updating[item._id] ? (t("saving") ?? "Saving...") : (t("markDelivered") ?? "Mark delivered")}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    title: {
      fontSize: 22,
      fontWeight: "900",
      color: palette.text,
      marginBottom: 12,
      textAlign: "left",
    },
    loadingBox: {
      paddingVertical: 16,
      alignItems: "center",
    },
    emptyBox: {
      backgroundColor: palette.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      gap: 8,
    },
    emptyTitle: { color: palette.text, fontSize: 18, fontWeight: "800" },
    emptyText: { color: palette.muted, textAlign: "center" },
    card: {
      backgroundColor: palette.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
      gap: 8,
    },
    cardRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cardTitle: { color: palette.text, fontWeight: "800" },
    status: { color: palette.accent, fontWeight: "700" },
    cardSub: { color: palette.muted },
    cardMeta: { color: palette.text, fontWeight: "600" },
    btnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
    primaryBtn: {
      backgroundColor: palette.accent,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
    },
    primaryBtnText: { color: "#fff", fontWeight: "700" },
    ghostBtn: {
      borderWidth: 1,
      borderColor: palette.border,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
    },
    ghostBtnText: { color: palette.text, fontWeight: "700" },
    simBtn: {
      borderWidth: 1,
      borderColor: palette.accent,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: "rgba(249,115,22,0.12)",
    },
    simBtnText: { color: palette.accent, fontWeight: "700" },
    dangerBtn: {
      backgroundColor: "#ef4444",
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
    },
    dangerBtnText: { color: "#fff", fontWeight: "700" },
  });
