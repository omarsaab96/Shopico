import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from "react-native";
import * as Location from "expo-location";
import Constants from "expo-constants";
import Screen from "../../components/Screen";
import Text from "../../components/Text";
import api from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { startDriverBackgroundTracking, stopDriverBackgroundTracking } from "../../lib/driverTracking";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Entypo from "@expo/vector-icons/Entypo";
import { Skeleton } from "../../components/Skeleton";
import Octicons from '@expo/vector-icons/Octicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const appJson = require("../../app.json");
const expoCfg: any = Constants.expoConfig || (Constants as any).manifest || {};
const GOOGLE_MAPS_KEY =
  expoCfg?.android?.config?.googleMaps?.apiKey ||
  expoCfg?.ios?.config?.googleMapsApiKey ||
  appJson?.expo?.android?.config?.googleMaps?.apiKey ||
  appJson?.expo?.ios?.config?.googleMapsApiKey ||
  "";

type DriverOrder = {
  _id: string;
  status: string;
  address: string;
  total: number;
  user?: { name?: string; phone?: string; email?: string } | string | null;
  createdAt?: string;
  statusHistory?: { status: string; at?: string }[];
  deliveryDistanceKm?: number;
  lat?: number | string;
  lng?: number | string;
  driverLocation?: { lat?: number | string; lng?: number | string } | null;
  addressRef?: {
    lat?: number | string;
    lng?: number | string;
    latitude?: number | string;
    longitude?: number | string;
    location?: {
      lat?: number | string;
      lng?: number | string;
      latitude?: number | string;
      longitude?: number | string;
      coordinates?: Array<number | string>;
    };
    coordinates?: Array<number | string>;
    phone?: string;
  } | string | null;
};

type Coordinate = { latitude: number; longitude: number };

const formatDistanceKm = (distance: number) => {
  if (!Number.isFinite(distance)) return "-";
  return distance < 10 ? distance.toFixed(1) : Math.round(distance).toString();
};

const toFiniteNumber = (value: number | string | undefined) => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : undefined;
};

export default function DriverOrders() {
  const router = useRouter();
  const { user } = useAuth();
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [routeDistanceLoading, setRouteDistanceLoading] = useState(false);
  const [routeDistances, setRouteDistances] = useState<Record<string, number | null>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const trackingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const [driverLocation, setDriverLocation] = useState<Coordinate | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const canDeliver = user?.role === "driver";

  const loadDriverLocation = useCallback(async () => {
    if (!canDeliver) return;
    setDistanceLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setDriverLocation(null);
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync({});
      if (lastKnown) {
        setDriverLocation({
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        });
      }

      const pos = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
      if (!pos) return;
      setDriverLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch {
    } finally {
      setDistanceLoading(false);
    }
  }, [canDeliver]);

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
      await Promise.all([load(false), loadDriverLocation()]);
    } finally {
      setRefreshing(false);
    }
  }, [load, loadDriverLocation]);

  const formatOrderDate = useCallback((value?: string) => {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("en-US", {
      weekday: "long",
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }, []);

  useEffect(() => {
    load();
    loadDriverLocation();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      if (trackingRef.current) clearInterval(trackingRef.current);
    };
  }, [load, loadDriverLocation]);

  useEffect(() => {
    if (!canDeliver) return;

    let mounted = true;
    Location.requestForegroundPermissionsAsync()
      .then(({ status }) => {
        if (!mounted || status !== "granted") return;
        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 30000,
            distanceInterval: 25,
          },
          (position) => {
            setDriverLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          }
        )
          .then((subscription) => {
            if (mounted) {
              locationWatcherRef.current = subscription;
            } else {
              subscription.remove();
            }
          })
          .catch(() => {
            if (mounted) setDriverLocation(null);
          });
      })
      .catch(() => {
        if (mounted) setDriverLocation(null);
      });

    return () => {
      mounted = false;
      locationWatcherRef.current?.remove();
      locationWatcherRef.current = null;
    };
  }, [canDeliver]);

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
    if (!startAt) return "";

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

    if (days > 0) return isRTL ? `${days}ي ${hours}س` : `${days}d ${hours}h`;
    if (hours > 0) return isRTL ? `${hours}س ${minutes}د ${seconds}ث` : `${hours}h ${minutes}m ${seconds}s`;
    return isRTL ? `${minutes}د ${seconds}ث` : `${minutes}m ${seconds}s`;
  }, [now]);

  const getStatusTime = useCallback((order: DriverOrder, status: string) => {
    return order.statusHistory?.find((entry) => entry.status === status)?.at;
  }, []);

  const getDeliveryDuration = useCallback((order: DriverOrder) => {
    const startedAt = getStatusTime(order, "SHIPPING");
    const deliveredAt = getStatusTime(order, "DELIVERED");
    return formatDuration(startedAt, order.status === "DELIVERED" ? deliveredAt : undefined);
  }, [formatDuration, getStatusTime]);

  const getCustomerName = (order: DriverOrder) => {
    if (typeof order.user === "object" && order.user) {
      return order.user.name || order.user.email || "-";
    }
    return "-";
  };

  const getCustomerPhone = (order: DriverOrder) => {
    if (typeof order.user === "object" && order.user?.phone) return order.user.phone;
    if (typeof order.addressRef === "object" && order.addressRef?.phone) return order.addressRef.phone;
    return "-";
  };

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
    const direct = toFiniteNumber(order[key]);
    if (direct !== undefined) return direct;
    if (typeof order.addressRef !== "object" || !order.addressRef) return undefined;

    const addressValue = order.addressRef[key];
    if (toFiniteNumber(addressValue) !== undefined) return toFiniteNumber(addressValue);

    const alternateKey = key === "lat" ? "latitude" : "longitude";
    const alternateValue = order.addressRef[alternateKey];
    if (toFiniteNumber(alternateValue) !== undefined) return toFiniteNumber(alternateValue);

    const locationValue = order.addressRef.location?.[key] ?? order.addressRef.location?.[alternateKey];
    if (toFiniteNumber(locationValue) !== undefined) return toFiniteNumber(locationValue);

    const coordinates = order.addressRef.location?.coordinates ?? order.addressRef.coordinates;
    const coordinateValue = coordinates?.[key === "lat" ? 1 : 0];
    return toFiniteNumber(coordinateValue);
  };

  const getCustomerCoordinate = (order: DriverOrder): Coordinate | null => {
    const lat = getOrderCoordinate(order, "lat");
    const lng = getOrderCoordinate(order, "lng");

    return lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : null;
  };

  const getStoredDriverCoordinate = (order: DriverOrder): Coordinate | null => {
    const lat = toFiniteNumber(order.driverLocation?.lat);
    const lng = toFiniteNumber(order.driverLocation?.lng);

    return lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : null;
  };

  const getRouteOrigin = (order: DriverOrder): Coordinate | null => {
    return driverLocation ?? getStoredDriverCoordinate(order);
  };

  const getRouteDistanceKm = useCallback(async (origin: Coordinate, destination: Coordinate) => {
    if (!GOOGLE_MAPS_KEY) return null;
    const originParam = `${origin.latitude},${origin.longitude}`;
    const destinationParam = `${destination.latitude},${destination.longitude}`;
    const url =
      `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originParam)}` +
      `&destination=${encodeURIComponent(destinationParam)}&mode=driving&key=${encodeURIComponent(GOOGLE_MAPS_KEY)}`;

    const response = await fetch(url);
    const json = await response.json();
    if (json?.status !== "OK" || !json?.routes?.[0]?.legs?.length) return null;

    const meters = json.routes[0].legs.reduce((sum: number, leg: any) => sum + Number(leg?.distance?.value || 0), 0);
    return meters > 0 ? meters / 1000 : null;
  }, []);

  useEffect(() => {
    if (!visibleOrders.length) {
      setRouteDistances({});
      return;
    }
    if (!GOOGLE_MAPS_KEY) {
      setRouteDistances({});
      return;
    }

    const routeInputs = visibleOrders
      .map((order) => ({
        order,
        origin: getRouteOrigin(order),
        destination: getCustomerCoordinate(order),
      }))
      .filter((item): item is { order: DriverOrder; origin: Coordinate; destination: Coordinate } =>
        Boolean(item.origin && item.destination)
      );

    if (!routeInputs.length) {
      setRouteDistances({});
      return;
    }

    let cancelled = false;
    setRouteDistanceLoading(true);
    Promise.all(
      routeInputs.map(async ({ order, origin, destination }) => {
        try {
          const distance = await getRouteDistanceKm(origin, destination);
          return [order._id, distance] as const;
        } catch {
          return [order._id, null] as const;
        }
      })
    )
      .then((entries) => {
        if (cancelled) return;
        setRouteDistances(Object.fromEntries(entries));
      })
      .finally(() => {
        if (!cancelled) setRouteDistanceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [driverLocation, getRouteDistanceKm, visibleOrders]);

  const getDriverRouteDistanceKm = (order: DriverOrder) => {
    const customerCoordinate = getCustomerCoordinate(order);
    const origin = driverLocation ?? getStoredDriverCoordinate(order);
    if (!origin || !customerCoordinate) return null;
    return routeDistances[order._id] ?? null;
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
          const driverRouteDistanceKm = getDriverRouteDistanceKm(item);
          return (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                {/* <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Text style={styles.cardTitle}>#{item._id.slice(-6)}</Text>
                </View> */}

                <View style={{ flexDirection: 'row', gap: 15, marginBottom: 10, alignItems: 'center' }}>
                  <View style={[{
                    borderWidth: 2,
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderColor: palette.border
                  },
                  item.status && item.status === "PENDING" && { borderColor: '#ff7a1f', backgroundColor: 'rgba(255, 122, 31, 0.1)' },
                  item.status && item.status === "PROCESSING" && { borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)' },
                  item.status && item.status === "SHIPPING" && { borderColor: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.1)' },
                  item.status && item.status === "DELIVERED" && { borderColor: '#16a34a', backgroundColor: 'rgba(22, 163, 74, 0.1)' },
                  item.status && item.status === "CANCELLED" && { borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' },
                  ]}>
                    {item.status && item.status === "PENDING" && <Entypo name="dots-three-horizontal" size={16} color="#ff7a1f" />}
                    {item.status && item.status === "PROCESSING" && <Feather name="loader" size={20} color="#2563eb" />}
                    {item.status && item.status === "SHIPPING" && <MaterialIcons name="delivery-dining" size={20} color="#4f46e5" />}
                    {item.status && item.status === "DELIVERED" && <MaterialIcons name="done-all" size={20} color="#16a34a" />}
                    {item.status && item.status === "CANCELLED" && <MaterialCommunityIcons name="cancel" size={20} color="#ef4444" />}
                  </View>

                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                      <Text style={styles.cardTitle}>#{item._id.slice(-6)}</Text>
                      <View style={styles.textSeperator}></View>
                      <Text style={[
                        styles.status,
                        // item.status && item.status === "PENDING" && { color: '#ff7a1f' },
                        // item.status && item.status === "PROCESSING" && { color: '#2563eb' },
                        // item.status && item.status === "SHIPPING" && { color: '#4f46e5' },
                        // item.status && item.status === "DELIVERED" && { color: '#16a34a' },
                        // item.status && item.status === "CANCELLED" && { color: '#ef4444' },
                      ]}>
                        {t(item.status) ?? item.status}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                      <Text style={styles.meta}>{formatOrderDate(item.createdAt)}</Text>

                    </View>
                  </View>

                  {/* <View style={styles.arrow}>
                    <Entypo
                      name={isRTL ? "chevron-left" : "chevron-right"}
                      size={24}
                      color={palette.accent}
                    />
                  </View> */}
                  <Text style={[styles.cardMeta, item.status !== "DELIVERED" && styles.elapsedValue]}>
                    {getDeliveryDuration(item)}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
                <Octicons name="location" size={24} color={palette.muted} style={{opacity:0.4}} />
                <View style={{ gap: isRTL? 0 : 2, flex: 1 }}>
                  <View style={{}}>
                    <Text style={[styles.address]}>
                      {item.address}
                    </Text>
                  </View>

                  <Text style={styles.cardDistance}>
                    {distanceLoading || routeDistanceLoading ? (
                      <Skeleton width={50} height={15} colorScheme={isDark ? "dark" : "light"} />
                    ) : (
                      <>
                        {driverRouteDistanceKm !== null ? formatDistanceKm(driverRouteDistanceKm) : "-"}{' '}
                        {t('km')}
                      </>
                    )}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
                <FontAwesome name="user-circle-o" size={24} color={palette.muted} style={{opacity:0.4}}/>

                <View style={{ gap: 2 }}>
                  <Text style={styles.addressLabel}>{getCustomerName(item)}</Text>
                  <Text style={styles.addressLabel}>{getCustomerPhone(item)}</Text>
                </View>
              </View>
              {/* 
              <View style={styles.customerBox}>

                <Text style={styles.customerName}></Text>
                <Text style={styles.customerPhone}>{getCustomerPhone(item)}</Text>
              </View> */}

              {
                ((item.status !== "DELIVERED" && getOrderCoordinate(item, "lat") !== undefined && getOrderCoordinate(item, "lng") !== undefined) ||
                  (item.status === "PROCESSING") ||
                  (isShipping)) &&

                <View style={styles.btnRow}>
                  {item.status !== "DELIVERED" && getOrderCoordinate(item, "lat") !== undefined && getOrderCoordinate(item, "lng") !== undefined ? (
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={() => openDirections(item)}
                      disabled={updating[item._id]}
                    >
                      <Text style={styles.primaryBtnText}>{t("directions") ?? "Directions"}</Text>
                    </TouchableOpacity>
                  ) : null}

                  {item.status === "PROCESSING" &&
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: palette.accent, borderColor: palette.accent }]}
                      onPress={() => startTracking(item)}
                      disabled={updating[item._id]}
                    >
                      <Text style={[styles.primaryBtnText, { color: 'white' }]}>
                        {updating[item._id] ? (t("starting") ?? "Starting...") : (t("startDelivery") ?? "Start delivery")}
                      </Text>
                    </TouchableOpacity>
                  }

                  {isShipping &&
                    <TouchableOpacity
                      style={styles.dangerBtn}
                      onPress={() => markDelivered(item._id)}
                      disabled={updating[item._id]}
                    >
                      <Text style={styles.dangerBtnText}>
                        {updating[item._id] ? (t("saving") ?? "Saving...") : (t("markDelivered") ?? "Mark delivered")}
                      </Text>
                    </TouchableOpacity>
                  }
                </View>
              }

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
    textSeperator: { width: 3, height: 3, borderRadius: 20, backgroundColor: palette.text },
    status: { color: palette.text, fontWeight: "700" },
    doneStatus: { color: "#16a34a" },

    cardMeta: { color: palette.muted, fontWeight: "600", fontSize: 12 },
    infoBlock: {
      gap: 3,
    },

    metricsRow: {
      // gap: 5,
    },
    metricBox: {
      gap: 4,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      flexWrap: 'wrap'
    },
    cardSub: {
      color: palette.text,
      fontSize: 12,
      fontWeight: "500",
      letterSpacing: 0.5,
    },
    address: {
      color: palette.text,
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.5,
      lineHeight:22
    },
    arrow: {
      // position: "absolute",
      // top: 8,
      // right: isRTL ? "auto" : 12,
      // left: isRTL ? 12 : "auto",
      height: 40,
      width: 40,
      justifyContent: 'center',
      alignItems: 'flex-end',
    },
    meta: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: '500', opacity: 0.6 },
    customerBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10
    },
    addressLabel: {
      color: palette.text,
      fontWeight: "600",
      fontSize: 14,
      lineHeight: 18,
    },
    customerName: {
      color: palette.text,
      fontSize: 13,
      fontWeight: "800",
      textAlign: "left",
    },
    customerPhone: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: "700",
      textAlign: "left",
      writingDirection: "ltr",
    },
    infoLabel: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: "500",
      textAlign: "left",
      textTransform: "uppercase",
    },
    cardDistance: {
      fontSize: 12,
      color: palette.accent,
      fontWeight: "700",
      // textAlign: isRTL ? "right" : "left",
      // writingDirection: isRTL ? "rtl" : "ltr",
      // paddingHorizontal: 5,
      // paddingVertical: 3,
      // borderRadius: 10,
      // backgroundColor: palette.surface,
      lineHeight: 14,
    },
    elapsedValue: {
      color: palette.accent,
      writingDirection: isRTL?'rtl':'ltr'
    },
    btnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    primaryBtn: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 10,
      flex: 1,
      borderWidth: 1,
      borderColor: palette.border,
    },
    primaryBtnText: { color: palette.text, fontWeight: "700", textAlign: 'center' },
    ghostBtn: {
      borderWidth: 1,
      borderColor: palette.border,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
    },
    ghostBtnText: { color: palette.text, fontWeight: "700" },
    directionsBtn: {
      backgroundColor: palette.accent,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 10,
      flex: 1,
    },
    directionsBtnText: {
      color: "#fff",
      fontWeight: "700",
      textAlign: 'center'
    },
    dangerBtn: {
      backgroundColor: "#16a34a",
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 10,
      flex: 1,
    },
    dangerBtnText: { color: "#fff", fontWeight: "700", textAlign: 'center' },
  });
