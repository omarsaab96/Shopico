import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from "react-native";
import * as Location from "expo-location";
import Screen from "../../components/Screen";
import Text from "../../components/Text";
import api from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { startDriverBackgroundTracking, stopDriverBackgroundTracking } from "../../lib/driverTracking";

type DriverOrder = {
  _id: string;
  status: string;
  address: string;
  total: number;
  createdAt?: string;
  statusHistory?: { status: string; at?: string }[];
  deliveryDistanceKm?: number;
  lat?: number;
  lng?: number;
  addressRef?: { lat?: number | string; lng?: number | string } | string | null;
};

export default function DriverOrders() {
  const router = useRouter();
  const { user } = useAuth();
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const trackingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const canDeliver = user?.role === "driver";

  const load = useCallback(async (showSpinner = true) => {
    if (!canDeliver) return;
    if (showSpinner) setLoading(true);
    try {
      const res = await api.get("/orders/driver");
      setOrders(res.data.data || []);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [canDeliver]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(false);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    load();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      if (trackingRef.current) clearInterval(trackingRef.current);
    };
  }, [load]);

  const visibleOrders = useMemo(
    () => orders.filter((order) => ["PENDING", "PROCESSING", "SHIPPING", "DELIVERED"].includes(order.status)),
    [orders]
  );

  const pendingCount = useMemo(
    () => visibleOrders.filter((order) => order.status !== "DELIVERED").length,
    [visibleOrders]
  );

  const deliveredCount = useMemo(
    () => visibleOrders.filter((order) => order.status === "DELIVERED").length,
    [visibleOrders]
  );

  const formatDuration = useCallback((startAt?: string, endAt?: string) => {
    if (!startAt) return "-";

    const start = new Date(startAt).getTime();
    const end = endAt ? new Date(endAt).getTime() : now;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return "-";

    const elapsedMs = Math.max(0, end - start);
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
  }, [now]);

  const getStatusTime = useCallback((order: DriverOrder, status: string) => {
    return order.statusHistory?.find((entry) => entry.status === status)?.at;
  }, []);

  const getDeliveryDuration = useCallback((order: DriverOrder) => {
    const startedAt = getStatusTime(order, "SHIPPING");
    const deliveredAt = getStatusTime(order, "DELIVERED");
    return formatDuration(startedAt, order.status === "DELIVERED" ? deliveredAt : undefined);
  }, [formatDuration, getStatusTime]);

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

  const startTracking = async (order: DriverOrder) => {
    setUpdating((prev) => ({ ...prev, [order._id]: true }));
    try {
      await api.put(`/orders/${order._id}/driver-status`, { status: "SHIPPING" });
      const tracking = await startDriverBackgroundTracking(order._id);
      if (!tracking.background) {
        Alert.alert(
          t("locationDenied") ?? "Location denied",
          "Background location is not enabled. Customers can track you while Shopico is open, but tracking may stop if you switch apps."
        );
      }
      setTrackingOrderId(order._id);
      await load();
      openDirections(order);
    } catch (error: any) {
      Alert.alert(
        t("locationDenied") ?? "Location denied",
        error?.message || "Please allow background location so customers can track this delivery."
      );
    } finally {
      setUpdating((prev) => ({ ...prev, [order._id]: false }));
    }
  };

  const markDelivered = async (orderId: string) => {
    setUpdating((prev) => ({ ...prev, [orderId]: true }));
    try {
      await api.put(`/orders/${orderId}/driver-status`, { status: "DELIVERED" });
      if (trackingRef.current) clearInterval(trackingRef.current);
      trackingRef.current = null;
      await stopDriverBackgroundTracking();
      setTrackingOrderId(null);
      await load();
    } finally {
      setUpdating((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const getOrderCoordinate = (order: DriverOrder, key: "lat" | "lng") => {
    const direct = order[key];
    if (Number.isFinite(direct)) return direct;
    const addressValue = typeof order.addressRef === "object" && order.addressRef ? order.addressRef[key] : undefined;
    const parsed = typeof addressValue === "string" ? Number(addressValue) : addressValue;
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const openDirections = (order: DriverOrder) => {
    const lat = getOrderCoordinate(order, "lat");
    const lng = getOrderCoordinate(order, "lng");
    router.push({
      pathname: "/driver-directions/[id]",
      params: {
        id: order._id,
        lat: String(lat),
        lng: String(lng),
        address: order.address,
      },
    });
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
      <FlatList
        data={visibleOrders}
        keyExtractor={(item) => item._id}
        contentContainerStyle={visibleOrders.length === 0 ? styles.emptyListContent : styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{t("orders") ?? "Orders"}</Text>
            <Text style={styles.subtitle}>
              {t("pendingOrders") ?? "Pending"}: {pendingCount} · {t("deliveredOrders") ?? "Delivered"}: {deliveredCount}
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={palette.accent} />
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>{t("noOrders") ?? "No orders yet"}</Text>
              <Text style={styles.emptyText}>{t("driverNoOrders") ?? "No assigned deliveries right now."}</Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.accent}
          />
        }
        renderItem={({ item }) => {
          const isShipping = item.status === "SHIPPING";
          const isTracking = trackingOrderId === item._id;
          return (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>#{item._id.slice(-6)}</Text>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                  <Text style={[styles.status, item.status === "DELIVERED" && styles.doneStatus]}>{t(item.status) ?? item.status}</Text>
                  <Text style={[styles.cardMeta, item.status !== "DELIVERED" && styles.elapsedValue]}>
                    {getDeliveryDuration(item)}
                  </Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                {/* <View style={styles.metricBox}>
                  <Text style={styles.infoLabel}>{t("address") ?? "Address"}</Text>
                  <Text style={styles.cardSub} numberOfLines={1}>{item.address}</Text>
                </View> */}
                {/* <View style={styles.metricBox}>
                  <Text style={styles.infoLabel}>{t("distance") ?? "Distance"}</Text>
                  <Text style={styles.cardSub}>
                    {item.deliveryDistanceKm !== undefined ? `${item.deliveryDistanceKm} ${t("km")}` : "-"}
                  </Text>
                </View> */}
                {/* <View style={styles.metricBox}>
                  <Text style={styles.infoLabel}>{t("deliveryTimer") ?? "Delivery time"}</Text>
                  <Text style={[styles.cardSub, item.status !== "DELIVERED" && styles.elapsedValue]}>
                    {getDeliveryDuration(item)}
                  </Text>
                </View> */}
                <View style={styles.metricBox}>
                  <Text style={styles.infoLabel}>{t("destination") ?? "Destination"}</Text>
                  <Text style={styles.cardSub} numberOfLines={1}>{item.address}</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.infoLabel}>{t("distance") ?? "Distance"}</Text>
                  <Text style={styles.cardSub}>{item.deliveryDistanceKm !== undefined ? `${item.deliveryDistanceKm} ${t("km")}` : "-"}</Text>
                </View>
              </View>

              <View style={styles.btnRow}>
                {item.status === "PROCESSING" || item.status === "PENDING" ? (
                  <>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={() => startTracking(item)}
                      disabled={updating[item._id]}
                    >
                      <Text style={styles.primaryBtnText}>
                        {updating[item._id] ? (t("starting") ?? "Starting...") : (t("startDelivery") ?? "Start delivery")}
                      </Text>
                    </TouchableOpacity>
                    {getOrderCoordinate(item, "lat") !== undefined && getOrderCoordinate(item, "lng") !== undefined ? (
                      <TouchableOpacity
                        style={styles.directionsBtn}
                        onPress={() => openDirections(item)}
                        disabled={updating[item._id]}
                      >
                        <Text style={styles.directionsBtnText}>{t("directions") ?? "Directions"}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </>
                ) : null}
                {isShipping ? (
                  <>
                    {/* <TouchableOpacity
                      style={styles.ghostBtn}
                      onPress={() => pushLocation(item._id)}
                      disabled={updating[item._id]}
                    >
                      <Text style={styles.ghostBtnText}>
                        {isTracking ? (t("trackingOn") ?? "Tracking") : (t("updateLocation") ?? "Update location")}
                      </Text>
                    </TouchableOpacity> */}
                    {getOrderCoordinate(item, "lat") !== undefined && getOrderCoordinate(item, "lng") !== undefined ? (
                      <TouchableOpacity
                        style={styles.directionsBtn}
                        onPress={() => openDirections(item)}
                        disabled={updating[item._id]}
                      >
                        <Text style={styles.directionsBtnText}>{t("directions") ?? "Directions"}</Text>
                      </TouchableOpacity>
                    ) : null}
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
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    title: {
      fontSize: 22,
      fontWeight: "900",
      color: palette.text,
      textAlign: "left",
    },
    header: {
      gap: 4,
      marginBottom: 2,
    },
    subtitle: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: "700",
      textAlign: "left",
    },
    loadingBox: {
      paddingVertical: 16,
      alignItems: "center",
    },
    listContent: {
      gap: 10,
      paddingBottom: 16,
    },
    emptyListContent: {
      flexGrow: 1,
      paddingBottom: 16,
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
    doneStatus: { color: "#16a34a" },
    cardSub: { 
      color: palette.text,
      fontSize: 12,
      fontWeight: "700",
     },
    cardMeta: { color: palette.text, fontWeight: "600" },
    infoBlock: {
      gap: 3,
    },
    infoLabel: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: "500",
      textAlign: "left",
      textTransform: "uppercase",
    },
    metricsRow: {
      gap: 5,
    },
    metricBox: {
      gap: 4,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    elapsedValue: {
      color: palette.accent,
    },
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
    directionsBtn: {
      backgroundColor: "#2563eb",
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
    },
    directionsBtnText: { color: "#fff", fontWeight: "700" },
    dangerBtn: {
      backgroundColor: "#ef4444",
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
    },
    dangerBtnText: { color: "#fff", fontWeight: "700" },
  });
