import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import * as Location from "expo-location";
import Constants from "expo-constants";
import Feather from "@expo/vector-icons/Feather";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Text from "../../components/Text";
import api from "../../lib/api";
import { pushDriverLocationOnce, stopDriverBackgroundTracking } from "../../lib/driverTracking";
import { useI18n } from "../../lib/i18n";
import { useTheme } from "../../lib/theme";

const MAP_FALLBACK = { latitude: 0, longitude: 0 };
const MAP_EDGE_PADDING = { top: 110, right: 50, bottom: 500, left: 50 };
const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f1f1f1" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7a7a7a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f1f1f1" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#e9e9e9" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#d7d7d7" }] },
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

type Coordinate = { latitude: number; longitude: number };
type DriverOrder = {
  _id: string;
  address?: string;
  lat?: number | string;
  lng?: number | string;
  addressRef?: { lat?: number | string; lng?: number | string } | string | null;
};

const toNumber = (value?: string | string[] | number | null) => {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const distanceMeters = (a: Coordinate, b: Coordinate) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export default function DriverDirections() {
  const { id, lat, lng, address } = useLocalSearchParams<{
    id: string;
    lat?: string;
    lng?: string;
    address?: string;
  }>();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(palette, isRTL, insets), [palette, isRTL, insets]);
  const [order, setOrder] = useState<DriverOrder | null>(null);
  const [origin, setOrigin] = useState<Coordinate | null>(null);
  const [routeOrigin, setRouteOrigin] = useState<Coordinate | null>(null);
  const [routeError, setRouteError] = useState(false);
  const [routeErrorMessage, setRouteErrorMessage] = useState<string | null>(null);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [locationDenied, setLocationDenied] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const lastRouteOriginRef = useRef<Coordinate | null>(null);
  const lastRouteRefreshRef = useRef(0);

  useEffect(() => {
    api
      .get("/orders/driver")
      .then((res) => {
        const list: DriverOrder[] = res.data.data || [];
        setOrder(list.find((item) => item._id === id) || null);
      })
      .catch(() => setOrder(null));
  }, [id]);

  const destination = useMemo(() => {
    const addressRef = typeof order?.addressRef === "object" && order.addressRef ? order.addressRef : null;
    const orderLat = order?.lat ?? addressRef?.lat;
    const orderLng = order?.lng ?? addressRef?.lng;
    const latitude = toNumber(orderLat ?? lat);
    const longitude = toNumber(orderLng ?? lng);
    return latitude !== null && longitude !== null ? { latitude, longitude } : null;
  }, [lat, lng, order]);

  const destinationAddress = order?.address || address || "-";

  const syncDriverLocation = useCallback((coords: Coordinate) => {
    if (!id) return;
    pushDriverLocationOnce(id, coords).catch(() => {});
  }, [id]);

  const fitRoute = useCallback((nextOrigin?: Coordinate | null) => {
    const currentOrigin = nextOrigin ?? routeOrigin ?? origin;
    if (!currentOrigin || !destination) return;
    mapRef.current?.fitToCoordinates([currentOrigin, destination], {
      edgePadding: MAP_EDGE_PADDING,
      animated: true,
    });
  }, [destination, origin, routeOrigin]);

  useEffect(() => {
    let mounted = true;

    const startLocationWatch = async () => {
      setLoadingLocation(true);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        if (!mounted) return;
        setLocationDenied(true);
        setLoadingLocation(false);
        return;
      }

      try {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        if (!mounted) return;
        const coords = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };
        setOrigin(coords);
        setRouteOrigin(coords);
        lastRouteOriginRef.current = coords;
        lastRouteRefreshRef.current = Date.now();
        syncDriverLocation(coords);
        if (destination) {
          mapRef.current?.fitToCoordinates([coords, destination], {
            edgePadding: MAP_EDGE_PADDING,
            animated: true,
          });
        }
        setLoadingLocation(false);

        watchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
            distanceInterval: 5,
            timeInterval: 3000,
          },
          (position) => {
            const next = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setOrigin(next);
            syncDriverLocation(next);

            const lastRouteOrigin = lastRouteOriginRef.current;
            const now = Date.now();
            if (!lastRouteOrigin || distanceMeters(lastRouteOrigin, next) >= 50 || now - lastRouteRefreshRef.current >= 30000) {
              lastRouteOriginRef.current = next;
              lastRouteRefreshRef.current = now;
              setRouteOrigin(next);
            }
          }
        );
      } finally {
        if (mounted) setLoadingLocation(false);
      }
    };

    startLocationWatch().catch(() => {
      if (!mounted) return;
      setLocationDenied(true);
      setLoadingLocation(false);
    });

    return () => {
      mounted = false;
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [destination, syncDriverLocation]);

  useEffect(() => {
    setRouteError(false);
    setRouteErrorMessage(null);
  }, [destination?.latitude, destination?.longitude, routeOrigin?.latitude, routeOrigin?.longitude]);

  const canUseDirections = Boolean(routeOrigin && destination && GOOGLE_MAPS_KEY && !routeError);
  const shouldDrawFallbackLine = Boolean(routeOrigin && destination && (!GOOGLE_MAPS_KEY || routeError));

  const markDelivered = useCallback(async () => {
    if (!id || delivering) return;
    setDelivering(true);
    try {
      await api.put(`/orders/${id}/driver-status`, { status: "DELIVERED" });
      await stopDriverBackgroundTracking();
      router.back();
    } finally {
      setDelivering(false);
    }
  }, [delivering, id, router]);

  const openInMaps = useCallback(() => {
    if (!destination) return;
    const destinationParam = `${destination.latitude},${destination.longitude}`;
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${destinationParam}`
        : `https://www.google.com/maps/dir/?api=1&destination=${destinationParam}`;
    Linking.openURL(url).catch(() => {});
  }, [destination]);

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={styles.map}
        customMapStyle={MAP_STYLE}
        
        followsUserLocation
        initialRegion={{
          latitude: origin?.latitude ?? destination?.latitude ?? MAP_FALLBACK.latitude,
          longitude: origin?.longitude ?? destination?.longitude ?? MAP_FALLBACK.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {origin ? (
          <Marker coordinate={origin} title={t("driver") ?? "Driver"} anchor={{ x: 0.5, y: 1 }}>
            <View style={[styles.pin, styles.driverPin]}>
              <MaterialIcons name="delivery-dining" size={20} color="#fff" />
            </View>
          </Marker>
        ) : null}
        {destination ? (
          <Marker coordinate={destination} title={t("destination") ?? "Destination"} anchor={{ x: 0.5, y: 1 }}>
            <View style={[styles.pin, styles.destinationPin]}>
              <Feather name="home" size={16} color={palette.text} />
            </View>
          </Marker>
        ) : null}
        {canUseDirections ? (
          <MapViewDirections
            key={`${routeOrigin?.latitude},${routeOrigin?.longitude}-${destination?.latitude},${destination?.longitude}`}
            origin={routeOrigin}
            destination={destination}
            apikey={GOOGLE_MAPS_KEY}
            mode="DRIVING"
            strokeWidth={5}
            strokeColor={palette.accent}
            onReady={(result) => {
              setRouteErrorMessage(null);
              setRouteDistance(result.distance);
              setRouteDuration(result.duration);
              mapRef.current?.fitToCoordinates(result.coordinates, {
                edgePadding: MAP_EDGE_PADDING,
                animated: true,
              });
            }}
            onError={(errorMessage) => {
              setRouteError(true);
              setRouteErrorMessage(String(errorMessage || "Directions error"));
            }}
          />
        ) : null}
        {shouldDrawFallbackLine ? (
          <Polyline coordinates={[routeOrigin!, destination!]} strokeWidth={5} strokeColor={palette.accent} />
        ) : null}
      </MapView>

      <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, isRTL && styles.backBtnRtl]}>
        <Feather name={isRTL ? "chevron-right" : "chevron-left"} size={22} color={palette.text} />
      </TouchableOpacity>

      <TouchableOpacity onPress={() => fitRoute()} style={[styles.recenterBtn, isRTL && styles.recenterBtnRtl]}>
        <Feather name="crosshair" size={20} color={palette.text} />
      </TouchableOpacity>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t("directions") ?? "Directions"}</Text>
            <Text style={styles.subtitle}>#{String(id || "").slice(-6)}</Text>
          </View>
          {loadingLocation ? <ActivityIndicator color={palette.accent} /> : null}
        </View>

        {/* <Text style={styles.label}>{t("destination") ?? "Destination"}</Text>
        <Text style={styles.address} numberOfLines={2}>{destinationAddress}</Text> */}

        <View style={styles.routeRow}>
          <View style={styles.routeMetric}>
            <Text style={styles.metricLabel}>{t("destination") ?? "Destination"}</Text>
            <Text style={styles.metricValue} numberOfLines={1}>{destinationAddress}</Text>
          </View>
          <View style={styles.routeMetric}>
            <Text style={styles.metricLabel}>{t("distance") ?? "Distance"}</Text>
            <Text style={styles.metricValue}>{routeDistance !== null ? `${routeDistance.toFixed(1)} ${t("km")}` : "-"}</Text>
          </View>
          <View style={styles.routeMetric}>
            <Text style={styles.metricLabel}>ETA</Text>
            <Text style={styles.metricValue}>{routeDuration !== null ? `${Math.round(routeDuration)} min` : "-"}</Text>
          </View>
        </View>

        {locationDenied || !destination ? (
          <Text style={styles.error}>
            {locationDenied
              ? t("locationDenied") ?? "Location denied"
              : `${t("routeUnavailable") ?? "Route unavailable"}: missing destination`}
          </Text>
        ) : null}
        {routeError ? (
          <Text style={styles.hint}>
            {t("routeUnavailable") ?? "Route unavailable"}: {routeErrorMessage || (t("showingDirectLine") ?? "Showing direct line")}
          </Text>
        ) : null}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={openInMaps} disabled={!destination}>
            <Text style={styles.secondaryBtnText}>{t("openInMaps") ?? "Open in Maps"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deliveredBtn} onPress={markDelivered} disabled={delivering}>
            <Text style={styles.deliveredBtnText}>
              {delivering ? (t("saving") ?? "Saving...") : (t("markDelivered") ?? "Mark delivered")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const createStyles = (palette: any, isRTL: boolean, insets: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: palette.background,
      paddingBottom:insets.bottom
    },
    map: {
      flex: 1,
    },
    backBtn: {
      position: "absolute",
      top: insets.top + 10,
      left: 16,
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      justifyContent: "center",
    },
    backBtnRtl: {
      left: undefined,
      right: 16,
    },
    recenterBtn: {
      position: "absolute",
      top: insets.top + 62,
      left: 16,
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      justifyContent: "center",
    },
    recenterBtnRtl: {
      left: undefined,
      right: 16,
    },
    pin: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: palette.accent,
    },
    driverPin: {
      borderColor: palette.card,
      backgroundColor: palette.accent,
    },
    destinationPin: {
      backgroundColor: palette.card,
    },
    panel: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: insets.bottom + 12,
      backgroundColor: palette.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.border,
      padding: 16,
      gap: 10,
    },
    panelHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    title: {
      color: palette.text,
      fontSize: 20,
      fontWeight: "900",
      textAlign: "left",
    },
    subtitle: {
      color: palette.muted,
      fontWeight: "800",
      textAlign: "left",
    },
    label: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: "900",
      textAlign: "left",
      textTransform: "uppercase",
    },
    address: {
      color: palette.text,
      fontWeight: "700",
      textAlign: "left",
    },
    routeRow: {
      gap: 5,
    },
    routeMetric: {
      gap: 4,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    metricLabel: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: "500",
      textAlign: "left",
      textTransform: "uppercase",
    },
    metricValue: {
      color: palette.text,
      fontSize: 12,
      fontWeight: "700",
    },
    error: {
      color: "#ef4444",
      fontWeight: "700",
      textAlign: "left",
    },
    hint: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: "700",
      textAlign: "left",
    },
    actionRow: {
      flexDirection: "row",
      gap: 10,
    },
    secondaryBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryBtnText: {
      color: palette.text,
      fontWeight: "900",
    },
    deliveredBtn: {
      flex: 1,
      backgroundColor: "#16a34a",
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    deliveredBtnText: {
      color: "#fff",
      fontWeight: "900",
    },
  });
