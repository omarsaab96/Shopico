import { TextInput } from "../../components/TextInput";
import OrderCancellation from "../../components/OrderCancellation";
import { formatQuantity } from "../../lib/productUnits";
import { DeviceEventEmitter } from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import LottieView from "lottie-react-native";
import Animated, { FadeIn, FadeOut, LinearTransition, ReduceMotion } from "react-native-reanimated";
import Screen from "../../components/Screen";
import Text from "../../components/Text";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import api from "../../lib/api";
import { useTheme } from "../../lib/theme";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Entypo from "@expo/vector-icons/Entypo";
import { useCurrency } from "../../lib/currency";


const AnimatedPill = Animated.createAnimatedComponent(TouchableOpacity);
const pillTransition = LinearTransition.duration(240).reduceMotion(ReduceMotion.System);

const ORDER_STATUSES = ["", "PENDING", "PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED"] as const;

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#ff7a1f",
  PROCESSING: "#2563eb",
  SHIPPING: "#4f46e5",
  DELIVERED: "#16a34a",
  CANCELLED: "#ef4444",
};

const statusIcon = (status: string, color: string) => {
  switch (status) {
    case "PENDING": return <Entypo name="dots-three-horizontal" size={14} color={color} />;
    case "PROCESSING": return <Feather name="loader" size={14} color={color} />;
    case "SHIPPING": return <MaterialIcons name="delivery-dining" size={16} color={color} />;
    case "DELIVERED": return <MaterialIcons name="done-all" size={16} color={color} />;
    case "CANCELLED": return <MaterialCommunityIcons name="cancel" size={16} color={color} />;
    default: return <Feather name="grid" size={14} color={color} />;
  }
};

export default function Orders() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusScrollRef = useRef<ScrollView>(null);
  const appStateRef = useRef(AppState.currentState);

  const { user } = useAuth();
  const { palette, isDark } = useTheme();
  const { t, isRTL, lang } = useI18n();
  const { selectedCurrency, formatMoney } = useCurrency();
  const styles = useMemo(() => createStyles(palette, isRTL, isDark), [palette, isRTL, isDark]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().replace(/^#/, "").toLocaleLowerCase();
    return orders.filter(order => {
      if (statusFilter && order.status !== statusFilter) return false;
      return !query || String(order._id).toLocaleLowerCase().includes(query) ||
        order.items?.some((item: any) =>
          String(item.product?.name || "").toLocaleLowerCase().includes(query));
    });
  }, [orders, search, statusFilter]);

  const formatOrderDate = useCallback((value?: string) => {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString(lang === "ar" ? "ar" : "en-US", {
      weekday: "long",
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }, [lang]);

  const load = useCallback(async () => {
    if (!user) return;
    console.log('start')
    setRefreshing(true);
    try {
      const res = await api.get("/orders", { params: { currencyId: selectedCurrency?._id } });
      const list = res.data.data || [];
      const sorted = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setOrders(sorted);
    } catch {
      setOrders([]);
    } finally {
      setRefreshing(false);
    }
  }, [selectedCurrency?._id, user]);

  const loadSilently = useCallback(async () => {
    if (!user) return;

    console.log('start2')
    try {
      const res = await api.get("/orders", { params: { currencyId: selectedCurrency?._id } });
      const list = res.data.data || [];
      const sorted = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setOrders(sorted);
    } catch {
      setOrders([]);
    }
  }, [selectedCurrency?._id, user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("shopico:notification", () => { void loadSilently(); });
    return () => sub.remove();
  }, [loadSilently]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      loadSilently();
    }, 20000);
  }, [loadSilently]);

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
      } else if (user) {
        startPolling();
      }
    });

    return () => sub.remove();
  }, [user, startPolling, stopPolling]);

  useFocusEffect(
    useCallback(() => {
      if (user) startPolling();
      return () => stopPolling();
    }, [user, startPolling, stopPolling])
  );

  return (
    <Screen>
      <Text style={styles.title}>{t("orders")}</Text>

      {user && orders.length > 0 && (
        <View style={styles.filters}>
          <View style={styles.searchRow}>
            <View style={styles.searchWrap}>
              <Feather name="search" size={18} color={palette.muted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={t("searchOrders")}
                placeholderTextColor={palette.muted}
                accessibilityLabel={t("searchOrders")}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity
                  style={styles.searchRight}
                  onPress={() => setSearch("")}
                  accessibilityRole="button"
                  accessibilityLabel={t("clear")}
                  hitSlop={8}
                >
                  <Feather name="x" size={18} color={palette.text} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View
            key={isRTL ? "rtl" : "ltr"}
            // ref={statusScrollRef}
            // horizontal
            // style={styles.statusScroll}
            style={styles.statusFilters}
            // showsHorizontalScrollIndicator={false}
            // contentContainerStyle={styles.statusFilters}
            // onContentSizeChange={() => {
            //   if (isRTL) statusScrollRef.current?.scrollToEnd({ animated: false });
            // }}
          >
            {ORDER_STATUSES.map(status => {
              const active = statusFilter === status;
              const color = STATUS_COLORS[status] || palette.accent;
              const foreground = active
                ? status ? color : isDark ? palette.text : "#fff"
                : palette.muted;
              return (
                <AnimatedPill
                  key={status || "all"}
                  layout={pillTransition}
                  style={[
                    styles.filterChip,
                    active && (status
                      ? { borderColor: color, backgroundColor: `${color}1A` }
                      : { borderColor: isDark ? "#2f2f2f" : "transparent", backgroundColor: isDark ? "transparent" : "#000" }),
                  ]}
                  onPress={() => setStatusFilter(status)}
                  accessibilityRole="button"
                  accessibilityLabel={t(status || "all")}
                  accessibilityState={{ selected: active }}
                >
                  {statusIcon(status, foreground)}
                  {active && (
                    <Animated.View
                      entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
                      exiting={FadeOut.duration(100).reduceMotion(ReduceMotion.System)}
                    >
                      <Text weight="black" style={[styles.filterLabel, { color: foreground }]} numberOfLines={1}>
                        {t(status || "all")}
                      </Text>
                    </Animated.View>
                  )}
                </AnimatedPill>
              );
            })}
          </View>

        </View>
      )}

      {!user ? (
        <View style={styles.emptyBox}>
          <LottieView
            autoPlay
            loop
            style={{ width: 120, height: 120 }}
            source={require("../../assets/noorders.json")}
          />
          <Text style={styles.emptyTitle}>
            {t("noOrders") ?? "No orders yet"}
          </Text>
          <Text style={styles.emptyText}>
            {t("loginToSeeOrders") ?? "Please login to view your orders."}
          </Text>

          <TouchableOpacity
            style={styles.browseBtn}
            onPress={() => {
              router.replace("/auth/login");
            }}
          >
            <Text style={styles.browseBtnText}>{t("login")}</Text>
          </TouchableOpacity>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyBox}>
          <LottieView
            autoPlay
            loop
            style={{ width: 120, height: 120 }}
            source={require("../../assets/noorders.json")}
          />
          <Text style={styles.emptyTitle}>{t("noOrders") ?? "No orders yet"}</Text>
          <Text style={styles.emptyText}>
            {t("noOrdersHint") ?? "Start browsing to place your first order."}
          </Text>
          <TouchableOpacity
            style={styles.browseBtn}
            onPress={() => router.replace("/(tabs)/store")}
          >
            <Text style={styles.browseBtnText}>{t("startBrowsing")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>{t("noResults")}</Text>
              <Text style={styles.emptyText}>{t("noMatchingOrdersHint")}</Text>
            </View>
          }
          keyExtractor={(o) => o._id}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ paddingBottom: 10, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={load}
              tintColor={palette.accent}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Link href={`/orders/${item._id}`} asChild>
                <TouchableOpacity>
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
                        <Text style={styles.name}>#{item._id.slice(-6)}</Text>
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

                    <View style={styles.arrow}>
                      <Entypo
                        name={isRTL ? "chevron-left" : "chevron-right"}
                        size={24}
                        color={palette.accent}
                      />
                    </View>
                  </View>

                  <View style={styles.itemsList}>
                    <View>
                      {item.items?.slice(0, 2).map((orderItem: any, index: number) => (
                        <View
                          key={orderItem._id ?? `${orderItem.product?.name}-${index}`}
                          style={styles.itemLine}
                        >
                          <Text style={styles.itemQty}>{formatQuantity(Math.max(0, orderItem.quantity - (orderItem.refundedQuantity || 0)), orderItem, isRTL)}</Text>
                          <Text style={styles.itemName}>{orderItem.product?.name}</Text>
                        </View>
                      ))}
                    </View>

                    {(item.items?.length ?? 0) > 2 ? (
                      <Text style={styles.moreItemsText}>
                        {item.items.length - 2} {item.items.length - 2 == 1 ? t("otherItem") : t("otherItems")}
                      </Text>
                    ) : null}
                  </View>

                  <Text style={[styles.value, {}]}>
                    {t("total")}: {formatMoney(item.total || 0, typeof item.currency === "object" ? item.currency : undefined)}
                  </Text>
                  
                  {item.status && item.status !== "CANCELLED" && <View style={{marginTop:10}}>
                    <OrderCancellation cartpage={false} ordersPage order={item} onUpdate={updated => setOrders(current => current.map(order =>
                      order._id === updated._id ? {
                        ...order, status: updated.status, cancelledByCustomer: updated.cancelledByCustomer,
                        refunds: updated.refunds, cancellationUntil: updated.cancellationUntil, serverTime: updated.serverTime
                      } : order
                    ))} />
                  </View>}
                </TouchableOpacity>
              </Link>


            </View>
          )}
        />
      )}
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean, isDark: boolean) =>
  StyleSheet.create({
    title: {
      color: palette.text,
      fontSize: 22,
      fontWeight: "900",
      marginBottom: 12,
      textAlign: isRTL ? "right" : "left",
      lineHeight:28
    },
    filters: { marginHorizontal: -16, marginBottom: 15 },
    searchRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, paddingHorizontal: 16 },
    searchWrap: {
      flex: 1,
      position: "relative",
      height: 48,
      borderRadius: 999,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.18 : 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: isDark ? 2 : 1,
    },
    searchIcon: { position: "absolute", left: 14, top: 14 },
    searchRight: { position: "absolute", right: 14, top: 14 },
    searchInput: {
      paddingHorizontal: 44,
      color: palette.text,
      textAlign: isRTL ? "right" : "left",
      fontSize: 14,
      fontWeight: "600",
    },
    // Use explicit direction so Screen's RTL layout does not reverse the row twice.
    statusScroll: { direction: "ltr" },
    statusFilters: {
      direction: "ltr",
      flexDirection: isRTL ? "row-reverse" : "row",
      flexGrow: 1,
      gap: 8,
      paddingHorizontal: 16,
    },
    filterChip: {
      overflow: "hidden",
      direction: "ltr",
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isDark ? palette.border : "rgba(15, 23, 42, 0.08)",
      backgroundColor: palette.card,
    },
    filterLabel: { color: palette.text, fontSize: 12, textAlign: "center",lineHeight:16 },

    row: {
      backgroundColor: palette.card,
      borderRadius: 15,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: palette.border,
      // position: "relative",
      // gap: 0,
    },



    name: { color: palette.text, fontWeight: "700", lineHeight: 14, fontSize: 14 },
    muted: { color: palette.muted },
    arrow: {
      // position: "absolute",
      // top: 8,
      // right: isRTL ? "auto" : 12,
      // left: isRTL ? 12 : "auto",
      height: 40,
      width: 40,
      justifyContent: 'center',
    },
    meta: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: '500', opacity: 0.6 },
    textSeperator: { width: 3, height: 3, borderRadius: 20, backgroundColor: palette.text },
    status: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: '600' },
    itemsList: { marginBottom: 15, gap: 5 },
    itemLine: { flexDirection: "row", gap: 8, alignItems: "baseline" },
    itemQty: {
      color: palette.accent,
      fontSize: 14,
      fontWeight: "900",
      lineHeight:22
    },
    itemName: {
      color: palette.text,
      fontWeight: "400",
      fontSize: 14,
      lineHeight:22
    },
    moreItemsText: {
      color: palette.muted,
      fontWeight: "600",
      fontSize: 13,
      opacity: 0.6,
      lineHeight:20,
    },
    value: { color: "black", fontSize: 13, fontWeight: "600" },

    emptyBox: {
      alignItems: "center",
      gap: 8,
      flex: 1,
      justifyContent: "center",
    },
    emptyTitle: { color: palette.text, fontSize: 18, fontWeight: "800" },
    emptyText: { color: palette.muted, textAlign: "center" },
    browseBtn: {
      backgroundColor: palette.accent,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      marginTop: 4,
    },
    browseBtnText: { color: "#fff", fontWeight: "700" },

    loginBtn: {
      backgroundColor: palette.accent,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
    },

    loginBtnText: { color: "#fff", fontWeight: "700" },
  });
