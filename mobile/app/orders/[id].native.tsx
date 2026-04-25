import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  AppState,
  Animated,
  useWindowDimensions,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polyline } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import Constants from "expo-constants";
import Text from "../../components/Text";
import api from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Entypo from "@expo/vector-icons/Entypo";
import EvilIcons from '@expo/vector-icons/EvilIcons';
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons';
import Octicons from '@expo/vector-icons/Octicons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Ionicons from '@expo/vector-icons/Ionicons';
import Fontisto from '@expo/vector-icons/Fontisto';

const MAP_FALLBACK = { latitude: 0, longitude: 0 };
const MAP_EDGE_PADDING = { top: 120, right: 20, bottom: 40, left: 20 };
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
  const scrollY = useRef(new Animated.Value(0)).current;
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL, insets), [palette, isRTL, insets]);
  // const mapHeight = useMemo(
  //   () =>
  //     scrollY.interpolate({
  //       inputRange: [0, 220],
  //       outputRange: [windowHeight * 0.7, windowHeight * 0.4],
  //       extrapolate: "clamp",
  //     }),
  //   [scrollY, windowHeight]
  // );
  const MAP_HEIGHT = windowHeight * 0.55;

  const mapTranslateY = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 220],
        outputRange: [0, -80],
        extrapolate: "clamp",
      }),
    [scrollY]
  );

  const mapScale = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 220],
        outputRange: [1, 0.96],
        extrapolate: "clamp",
      }),
    [scrollY]
  );

  const [order, setOrder] = useState<any>(null);
  const [branch, setBranch] = useState<any>(null);
  const [routeError, setRouteError] = useState(false);
  const [routeErrorMessage, setRouteErrorMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const addressLabel =
    order?.addressRef && typeof order.addressRef === "object" ? order.addressRef.label : "";
  const orderBranch =
    order?.branchId && typeof order.branchId === "object" ? order.branchId : branch;
  const branchName = orderBranch?.name || (t("branch") ?? "Branch");
  const driverName =
    order?.driverId && typeof order.driverId === "object"
      ? order.driverId.name || order.driverId.email || null
      : null;
  const driverRatingAverage =
    order?.driverId && typeof order.driverId === "object" ? Number(order.driverId.ratingAverage || 0) : 0;
  const driverRatingCount =
    order?.driverId && typeof order.driverId === "object" ? Number(order.driverId.ratingCount || 0) : 0;
  const hasRatedDriver = typeof order?.driverRating === "number";
  const [ratingDraft, setRatingDraft] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  const getOrderItemKey = useCallback((item: any, index: number) => {
    const productId =
      typeof item?.product === "string"
        ? item.product
        : item?.product?._id ?? item?.product?.id;

    if (productId) return `${productId}-${index}`;
    if (item?._id) return `${item._id}-${index}`;

    return `${item?.product?.name ?? "item"}-${item?.price ?? 0}-${item?.quantity ?? 0}-${index}`;
  }, []);

  useEffect(() => {
    api.get(`/orders/${id}`).then((res) => {
      const payload = res.data.data;
      setOrder(payload);
      const branchId =
        typeof payload?.branchId === "string"
          ? payload.branchId
          : payload?.branchId?._id;
      const populatedBranch =
        payload?.branchId && typeof payload.branchId === "object" ? payload.branchId : null;

      if (populatedBranch) {
        setBranch(populatedBranch);
        return;
      }

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
  const branchOrigin = toCoordinate(orderBranch?.lat, orderBranch?.lng);
  const destination = toCoordinate(order?.lat, order?.lng);

  const effectiveOrigin =
    order?.status === "SHIPPING" && driverOrigin ? driverOrigin : branchOrigin;
  const showDriver = order?.status === "SHIPPING" && driverOrigin;

  const canUseDirections = Boolean(effectiveOrigin && destination && GOOGLE_MAPS_KEY && !routeError);
  const shouldDrawFallbackLine = Boolean(effectiveOrigin && destination && (!GOOGLE_MAPS_KEY || routeError));

  useEffect(() => {
    if (!effectiveOrigin || !destination) return;
    mapRef.current?.fitToCoordinates([effectiveOrigin, destination], {
      edgePadding: MAP_EDGE_PADDING,
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

  const submitDriverRating = useCallback(async () => {
    if (!id || ratingDraft < 1 || submittingRating) return;

    setSubmittingRating(true);
    try {
      const res = await api.post(`/orders/${id}/driver-rating`, { rating: ratingDraft });
      setOrder(res.data.data);
      setRatingDraft(0);
      Alert.alert(
        t("ratingSubmitted") ?? "Rating submitted",
        t("ratingSubmittedCopy") ?? "Thanks for rating your driver."
      );
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || "Failed to submit rating";
      Alert.alert(t("networkError") ?? "Unable to reach the server", message);
    } finally {
      setSubmittingRating(false);
    }
  }, [id, ratingDraft, submittingRating, t]);

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

  const canRateDriver =
    order.status === "DELIVERED" &&
    Boolean(order.driverId) &&
    !hasRatedDriver;

  const formatOrderDate = (value?: string) => {
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
  }

  return (
    <View style={styles.safe}>
      <View style={styles.root}>
        {/* <Animated.View style={[styles.mapWrap, { height: mapHeight }]}> */}
        <Animated.View
          style={[
            styles.mapWrap,
            {
              height: MAP_HEIGHT,
              transform: [{ translateY: mapTranslateY }, { scale: mapScale }],
            },
          ]}
        >
          <MapView
            ref={mapRef}
            style={styles.mapFull}
            customMapStyle={MAP_STYLE}
            initialRegion={{
              latitude: effectiveOrigin?.latitude ?? destination?.latitude ?? MAP_FALLBACK.latitude,
              longitude: effectiveOrigin?.longitude ?? destination?.longitude ?? MAP_FALLBACK.longitude,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
              zoom: 12
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
                    edgePadding: MAP_EDGE_PADDING,
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
        </Animated.View>

        <ScrollView
          style={styles.sheet}
          contentContainerStyle={styles.sheetScroll}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
        >
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
              <Text style={styles.subtle}>{formatOrderDate(order.createdAt)}</Text>
            </View>

            <View style={[{
              borderWidth: 2,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: palette.border,
              paddingHorizontal: 10,
              paddingVertical: 5,
              flexDirection: 'row',
              gap: 5,
            },
            order.status && order.status === "PENDING" && { borderColor: '#ff7a1f', backgroundColor: 'rgba(255, 122, 31, 0.1)' },
            order.status && order.status === "PROCESSING" && { borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)' },
            order.status && order.status === "SHIPPING" && { borderColor: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.1)' },
            order.status && order.status === "DELIVERED" && { borderColor: '#16a34a', backgroundColor: 'rgba(22, 163, 74, 0.1)' },
            order.status && order.status === "CANCELLED" && { borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' },
            ]}>
              {order.status && order.status === "PENDING" && <Entypo name="dots-three-horizontal" size={16} color="#ff7a1f" />}
              {order.status && order.status === "PROCESSING" && <Feather name="loader" size={20} color="#2563eb" />}
              {order.status && order.status === "SHIPPING" && <MaterialIcons name="delivery-dining" size={20} color="#4f46e5" />}
              {order.status && order.status === "DELIVERED" && <MaterialIcons name="done-all" size={20} color="#16a34a" />}
              {order.status && order.status === "CANCELLED" && <MaterialCommunityIcons name="cancel" size={20} color="#ef4444" />}
              <Text numberOfLines={1} style={[{
                fontSize: 12,
                fontWeight: '600',
              },
              order.status && order.status === "PENDING" && { color: '#ff7a1f' },
              order.status && order.status === "PROCESSING" && { color: '#2563eb' },
              order.status && order.status === "SHIPPING" && { color: '#4f46e5' },
              order.status && order.status === "DELIVERED" && { color: '#16a34a' },
              order.status && order.status === "CANCELLED" && { color: '#ef4444' },
              ]}>
                {t(order.status) ?? order.status}
              </Text>
            </View>
          </View>

          <View style={styles.detailsSection}>
            <View style={{ marginBottom: 10, borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
                <Ionicons name="storefront-outline" size={24} color={palette.muted} />

                <View style={{ gap: 5 }}>
                  <Text style={styles.addressLabel}>{branchName}</Text>
                </View>
              </View>
            </View>

            <View style={{ marginBottom: 10, borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
                <Octicons name="location" size={24} color={palette.muted} />

                <View style={{ gap: 2 }}>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    {addressLabel ?
                      <Text style={styles.addressLabel}>{addressLabel}</Text>
                      :
                      <Text style={styles.addressLabel}>{t('distance')}</Text>
                    }
                    <Text style={styles.deliveryDistanceKm}>
                      {order.deliveryDistanceKm > 1 ? Math.ceil(order.deliveryDistanceKm - 1) : order.deliveryDistanceKm} {t('km')}
                    </Text>
                  </View>
                  <Text style={styles.addressText}>{order.address}</Text>
                </View>
              </View>
            </View>

            <View style={[]}>
              <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
                <MaterialIcons name="delivery-dining" size={24} color={palette.muted} />
                <View style={{ gap: 2 }}>
                  <Text style={styles.addressLabel}>{driverName ? driverName : t("noAssignedDriverYet") ?? "No driver assigned yet"}</Text>

                  {(driverName) && 
                    <View>
                      {hasRatedDriver ? (
                        <Text style={styles.addressText}>
                          {t("yourRating") ?? "Your rating"}: {order.driverRating}/5
                        </Text>
                      ) : driverRatingCount > 0 ? (
                        <Text style={styles.addressText}>
                          <Fontisto name="star" size={12} color={palette.text} /> {driverRatingAverage.toFixed(1)} ({driverRatingCount})
                        </Text>
                      ) : (
                        <Text style={styles.addressText}>{t("noRatingsYet") ?? "No ratings yet"}</Text>
                      )}

                      {canRateDriver ? (
                        <View style={styles.ratingBox}>
                          <Text style={styles.ratingHint}>{t("tapToRate") ?? "Tap a star to rate"}</Text>
                          <View style={styles.ratingRow}>
                            {[1, 2, 3, 4, 5].map((value) => (
                              <TouchableOpacity
                                key={value}
                                onPress={() => setRatingDraft(value)}
                                hitSlop={8}
                                disabled={submittingRating}
                              >
                                <MaterialIcons
                                  name={value <= ratingDraft ? "star" : "star-border"}
                                  size={22}
                                  color={value <= ratingDraft ? "#f59e0b" : palette.muted}
                                />
                              </TouchableOpacity>
                            ))}
                          </View>
                          <TouchableOpacity
                            style={[styles.rateBtn, (!ratingDraft || submittingRating) && styles.rateBtnDisabled]}
                            onPress={submitDriverRating}
                            disabled={!ratingDraft || submittingRating}
                          >
                            <Text style={styles.rateBtnText}>
                              {submittingRating ? (t("saving") ?? "Saving...") : (t("submitRating") ?? "Submit rating")}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  }


                </View>
              </View>
            </View>
          </View>

          <View style={styles.detailsSection}>
            <View style={styles.row}>
              <Text style={styles.label}>{t('subtotal')}</Text>
              <Text style={styles.value}>{order.subtotal.toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{t('deliveryFee')}</Text>
              <Text style={styles.value}>{order.deliveryFee.toLocaleString()}</Text>
            </View>
            <View style={styles.heroTotal}>
              <Text style={styles.totalText}>{t('total')} <Text style={styles.totalCurrency}>({t("syp")})</Text></Text>
              <Text style={styles.totalText}>{order.total.toLocaleString()}</Text>
            </View>
            <View style={[styles.row, { marginBottom: 0 }]}>
              <Text style={styles.label}>{t('paymentMethod')}</Text>
              {order.paymentMethod == 'CASH_ON_DELIVERY' && <View style={styles.valueWithIcon}>
                <Text style={styles.value}>{t('cash')}</Text>
                <Image source={require('../../assets/bill.png')} style={styles.methodIcon} />
              </View>}
            </View>
          </View>

          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>{t("items") ?? "Items"}</Text>
            {order.items.map((item: any, index: number) => (
              <View key={getOrderItemKey(item, index)} style={styles.itemRow}>
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
    </View>
  );
}

const createStyles = (palette: any, isRTL: boolean, insets: any) =>
  StyleSheet.create({
    detailsSection: {
      backgroundColor: palette.card,
      borderRadius: 15,
      padding: 10,
      borderWidth: 1,
      borderColor: palette.border,
    },
    safe: {
      flex: 1,
      backgroundColor: palette.background,
      direction: isRTL ? "rtl" : "ltr",
    },
    root: {
      flex: 1,
      direction: isRTL ? "rtl" : "ltr",
    },
    mapWrap: {
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
      top: 60,
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
    sheet: {
      flex: 1,
    },
    sheetScroll: {
      paddingHorizontal: 10,
      paddingTop: 10,
      paddingBottom: insets.bottom + 10,
      gap: 12,
      borderWidth: 2,
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
      textAlign: isRTL ? "right" : "left",
      writingDirection: isRTL ? "rtl" : "ltr",
    },
    sheetHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: {
      color: palette.text,
      fontSize: 22,
      fontWeight: "900",
      lineHeight: 26,
      marginBottom: 5
    },
    subtle: {
      color: palette.muted,
      fontSize: 12,
      lineHeight: 14,
      fontWeight: "600",
      opacity: 0.6
    },
    heroTotal: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: "center",
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: palette.border,
      borderStyle: 'dashed',
      marginBottom: 5
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: "center",
      marginBottom: 10
    },
    totalText: {
      color: palette.text,
      fontSize: 22,
      fontWeight: "700",
      textAlign: isRTL ? "right" : "left",
      paddingBottom: 5,
      writingDirection: isRTL ? "rtl" : "ltr",
    },
    totalCurrency: {
      color: palette.text,
      fontSize: 14,
      fontWeight: "600",
      textAlign: isRTL ? "right" : "left",
      writingDirection: isRTL ? "rtl" : "ltr",
    },
    label: {
      color: palette.text,
      fontSize: 14,
      fontWeight: "600",
      textAlign: isRTL ? "right" : "left",
      writingDirection: isRTL ? "rtl" : "ltr",
    },
    value: {
      color: palette.text,
      opacity: 0.4,
      fontSize: 14,
      fontWeight: "600",
      textAlign: isRTL ? "right" : "left",
      writingDirection: isRTL ? "rtl" : "ltr",
    },
    valueWithIcon: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    ratingBox: {
      gap: 8,
      marginTop: 4,
      alignItems: isRTL ? "flex-end" : "flex-start",
    },
    ratingHint: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: "600",
      textAlign: isRTL ? "right" : "left",
      writingDirection: isRTL ? "rtl" : "ltr",
    },
    ratingRow: {
      flexDirection: isRTL ? "row-reverse" : "row",
      gap: 4,
      alignItems: "center",
    },
    rateBtn: {
      backgroundColor: palette.accent,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    rateBtnDisabled: {
      opacity: 0.5,
    },
    rateBtnText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "700",
    },
    methodIcon: {
      width: 30,
      height: 30,
      resizeMode: 'contain'
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
      justifyContent: "flex-start",
      alignItems: "center",
    },
    sectionTitle: {
      color: palette.text,
      fontSize: 16,
      fontWeight: "800",
      textAlign: isRTL ? "right" : "left",
      writingDirection: isRTL ? "rtl" : "ltr",
    },
    sectionMeta: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: "600",
      textAlign: isRTL ? "right" : "left",
      writingDirection: isRTL ? "rtl" : "ltr",
    },
    addressText: {
      color: palette.text,
      fontWeight: "500",
      fontSize: 13,
      lineHeight: 16,
      opacity: 0.4,
    },
    addressLabel: {
      color: palette.text,
      fontWeight: "600",
      fontSize: 14,
      lineHeight: 18,
    },
    itemRow: {
      flexDirection: isRTL ? "row-reverse" : "row",
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
      textAlign: isRTL ? "right" : "left",
      writingDirection: isRTL ? "rtl" : "ltr",
    },
    itemPrice: {
      color: palette.text,
      fontWeight: "800",
      textAlign: isRTL ? "right" : "left",
      writingDirection: isRTL ? "rtl" : "ltr",
    },

    deliveryDistanceKm: {
      fontSize: 12,
      color: palette.text,
      fontWeight: "600",
      textAlign: isRTL ? "right" : "left",
      writingDirection: isRTL ? "rtl" : "ltr",
      paddingHorizontal: 5,
      paddingVertical: 3,
      borderRadius: 10,
      backgroundColor: palette.surface,
      lineHeight: 14,
    },
    oldDistance: {
      fontSize: 12,
      color: palette.text,
      textDecorationLine: "line-through",
    },
  });
