import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polyline } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import Feather from "@expo/vector-icons/Feather";
import Constants from "expo-constants";
import Text from "../../components/Text";
import api from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";

const MAP_FALLBACK = { latitude: 30.5085, longitude: 47.7804 };
const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f1f1f1" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7a7a7a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f1f1f1" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#d6d6d6" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#e9e9e9" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#7a7a7a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#d7d7d7" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#dcdcdc" }] },
];

const appJson = require("../../app.json");
const expoCfg: any = Constants.expoConfig || (Constants as any).manifest || {};
const GOOGLE_MAPS_KEY =
  expoCfg?.android?.config?.googleMaps?.apiKey ||
  expoCfg?.ios?.config?.googleMapsApiKey ||
  appJson?.expo?.android?.config?.googleMaps?.apiKey ||
  appJson?.expo?.ios?.config?.googleMapsApiKey ||
  "";

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  const [order, setOrder] = useState<any>(null);
  const [branch, setBranch] = useState<any>(null);
  const [routeError, setRouteError] = useState(false);
  const [routeErrorMessage, setRouteErrorMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    api.get(`/orders/${id}`).then((res) => {
      const payload = res.data.data;
      setOrder(payload);
      const branchId = payload?.branchId;
      if (branchId) {
        api
          .get("/branches/public")
          .then((branchRes) => {
            const list = branchRes.data.data || [];
            const match = list.find((b: any) => b._id === branchId);
            if (match) setBranch(match);
          })
          .catch(() => setBranch(null));
      }
    });
  }, [id]);

  const toCoordinate = (lat?: number | string, lng?: number | string) => {
    const latNum = typeof lat === "string" ? Number(lat) : lat;
    const lngNum = typeof lng === "string" ? Number(lng) : lng;
    return Number.isFinite(latNum) && Number.isFinite(lngNum)
      ? { latitude: latNum as number, longitude: lngNum as number }
      : null;
  };

  const driverLocation = order?.driverLocation;
  const driverOrigin = toCoordinate(driverLocation?.lat, driverLocation?.lng);
  const branchOrigin = toCoordinate(branch?.lat, branch?.lng);
  const destination = toCoordinate(order?.lat, order?.lng);

  const effectiveOrigin =
    order?.status === "SHIPPING" && driverOrigin ? driverOrigin : branchOrigin;
  const showDriver = order?.status === "SHIPPING" && driverOrigin;

  const canUseDirections = Boolean(effectiveOrigin && destination && GOOGLE_MAPS_KEY && !routeError);
  const shouldDrawFallbackLine = Boolean(effectiveOrigin && destination && (!GOOGLE_MAPS_KEY || routeError));

  useEffect(() => {
    if (!effectiveOrigin || !destination) return;
    mapRef.current?.fitToCoordinates([effectiveOrigin, destination], {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
      animated: true,
    });
  }, [effectiveOrigin?.latitude, effectiveOrigin?.longitude, destination?.latitude, destination?.longitude]);

  useEffect(() => {
    setRouteError(false);
    setRouteErrorMessage(null);
  }, [effectiveOrigin?.latitude, effectiveOrigin?.longitude, destination?.latitude, destination?.longitude]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      api.get(`/orders/${id}`).then((res) => {
        setOrder(res.data.data);
      });
    }, 15000);
  }, [id]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;
      if (nextState !== "active") {
        stopPolling();
        return;
      }
      if (order && ["PENDING", "PROCESSING", "SHIPPING"].includes(order.status)) {
        startPolling();
      }
    });
    return () => {
      sub.remove();
    };
  }, [order, startPolling, stopPolling]);

  useFocusEffect(
    useCallback(() => {
      if (order && ["PENDING", "PROCESSING", "SHIPPING"].includes(order.status)) {
        startPolling();
      }
      return () => stopPolling();
    }, [order, startPolling, stopPolling])
  );

  if (!order) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={styles.mapFull}
            customMapStyle={MAP_STYLE}
            initialRegion={{
              latitude: effectiveOrigin?.latitude ?? destination?.latitude ?? MAP_FALLBACK.latitude,
              longitude: effectiveOrigin?.longitude ?? destination?.longitude ?? MAP_FALLBACK.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            {showDriver ? (
              <Marker coordinate={driverOrigin} title={t("driver") ?? "Driver"} anchor={{ x: 0.5, y: 1 }}>
                <View style={[styles.pin, styles.pinDriver]}>
                  <Feather name="navigation-2" size={16} color="#fff" />
                </View>
              </Marker>
            ) : null}
            {branchOrigin ? (
              <Marker coordinate={branchOrigin} title={t("branch") ?? "Branch"} anchor={{ x: 0.5, y: 1 }}>
                <View style={[styles.pin, styles.pinBranch]}>
                  <Feather name="home" size={16} color="#fff" />
                </View>
              </Marker>
            ) : null}
            {destination ? (
              <Marker coordinate={destination} title={t("destination") ?? "Destination"} anchor={{ x: 0.5, y: 1 }}>
                <View style={[styles.pin, styles.pinDestination]}>
                  <Feather name="map-pin" size={16} color="#fff" />
                </View>
              </Marker>
            ) : null}
            {canUseDirections ? (
              <MapViewDirections
                key={`${effectiveOrigin.latitude},${effectiveOrigin.longitude}-${destination.latitude},${destination.longitude}`}
                origin={effectiveOrigin}
                destination={destination}
                apikey={GOOGLE_MAPS_KEY}
                strokeWidth={4}
                strokeColor={palette.accent}
                onReady={(result) => {
                  mapRef.current?.fitToCoordinates(result.coordinates, {
                    edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
                    animated: true,
                  });
                }}
                onError={(errorMessage) => {
                  setRouteError(true);
                  setRouteErrorMessage(String(errorMessage || "Directions error"));
                  console.warn("MapViewDirections error:", errorMessage);
                }}
              />
            ) : null}
            {shouldDrawFallbackLine ? (
              <Polyline
                coordinates={[effectiveOrigin, destination]}
                strokeWidth={4}
                strokeColor={palette.accent}
              />
            ) : null}
          </MapView>

          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, isRTL && styles.backBtnRtl]}
          >
            <Feather name={isRTL ? "chevron-right" : "chevron-left"} size={22} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.sheetScroll}>
          {routeErrorMessage ? (
            <View style={styles.routeWarning}>
              <Text style={styles.routeWarningText}>
                {t("routeUnavailable") ?? "Route unavailable"} · {routeErrorMessage}
              </Text>
            </View>
          ) : null}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.title}>{t("order")} #{order._id.slice(-6)}</Text>
              <Text style={styles.subtle}>{new Date(order.createdAt).toLocaleString()}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{t(order.status) ?? order.status}</Text>
            </View>
          </View>

          <Text style={styles.heroTotal}>
            {order.total.toLocaleString()} {t("syp")}
          </Text>

          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t("delivery") ?? "Delivery"}</Text>
              <Text style={styles.sectionMeta}>
                {order.deliveryDistanceKm} {t("km")}
              </Text>
            </View>
            <Text style={styles.addressText}>{order.address}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("items") ?? "Items"}</Text>
            {order.items.map((item: any) => (
              <View key={item.product} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>
                    {item.quantity} x {item.product?.name || item.product}
                  </Text>
                </View>
                <Text style={styles.itemPrice}>{item.price.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: palette.background,
    },
    root: {
      flex: 1,
    },
    mapWrap: {
      height: "70%",
      width: "100%",
    },
    mapFull: {
      width: "100%",
      height: "100%",
    },
    pin: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "#fff",
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
    pinBranch: {
      backgroundColor: palette.accent,
    },
    pinDestination: {
      backgroundColor: "#ef4444",
    },
    pinDriver: {
      backgroundColor: "#0ea5e9",
    },
    backBtn: {
      position: "absolute",
      top: 16,
      left: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
      elevation: 6,
    },
    backBtnRtl: {
      left: undefined,
      right: 16,
    },
    sheetScroll: {
      paddingHorizontal: 16,
      paddingBottom: 24,
      gap: 12,
    },
    routeWarning: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    routeWarningText: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: "600",
      textAlign: "left",
    },
    sheetHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      marginTop: 6,
    },
    title: {
      color: palette.text,
      fontSize: 22,
      fontWeight: "900",
      textAlign: "left",
    },
    subtle: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: "600",
      textAlign: "left",
    },
    heroTotal: {
      color: palette.accent,
      fontSize: 22,
      fontWeight: "900",
      textAlign: "left",
    },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    statusPillText: {
      color: palette.accent,
      fontWeight: "800",
      fontSize: 12,
      textTransform: "uppercase",
    },
    card: {
      backgroundColor: palette.card,
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.border,
      gap: 10,
    },
    sectionHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    sectionTitle: {
      color: palette.text,
      fontSize: 16,
      fontWeight: "800",
      textAlign: "left",
    },
    sectionMeta: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: "600",
      textAlign: "left",
    },
    addressText: {
      color: palette.text,
      fontWeight: "600",
      fontSize: 13,
      textAlign: "left",
    },
    itemRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
      gap: 10,
    },
    itemInfo: {
      flex: 1,
      gap: 2,
    },
    itemName: {
      color: palette.text,
      fontWeight: "700",
      fontSize: 14,
      textAlign: "left",
    },
    itemPrice: {
      color: palette.text,
      fontWeight: "800",
      textAlign: "left",
    },
  });
