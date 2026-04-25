import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import LottieView from "lottie-react-native";
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


export default function Orders() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const { user } = useAuth();
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

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

  const load = useCallback(async () => {
    if (!user) return;

    setRefreshing(true);
    try {
      const res = await api.get("/orders");
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
  }, [user]);

  const loadSilently = useCallback(async () => {
    if (!user) return;

    try {
      const res = await api.get("/orders");
      const list = res.data.data || [];
      const sorted = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setOrders(sorted);
    } catch {
      setOrders([]);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

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

      {!user ? (
        <View style={styles.emptyBox}>
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
          data={orders}
          keyExtractor={(o) => o._id}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ paddingBottom: 10 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={load}
              tintColor={palette.accent}
            />
          }
          renderItem={({ item }) => (
            <Link href={`/orders/${item._id}`} asChild>
              <TouchableOpacity style={styles.row}>
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
                        <Text style={styles.itemQty}>{orderItem.quantity}</Text>
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

                <Text style={styles.value}>
                  {t("total")}: {item.total?.toLocaleString()} {t("SYP") ?? "SYP"}
                </Text>
              </TouchableOpacity>
            </Link>
          )}
        />
      )}
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    title: {
      color: palette.text,
      fontSize: 22,
      fontWeight: "900",
      marginBottom: 12,
      textAlign: "left",
    },

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

    name: { color: palette.text, fontWeight: "700", lineHeight: 14, fontSize: 14 },
    muted: { color: palette.muted },
    meta: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: '500', opacity: 0.6 },
    textSeperator: { width: 3, height: 3, borderRadius: 20, backgroundColor: palette.text },
    status: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: '600' },
    itemsList: { marginBottom: 15, gap: 5 },
    itemLine: { flexDirection: "row", gap: 8, alignItems: "baseline" },
    itemQty: {
      color: palette.accent,
      fontSize: 14,
      fontWeight: "900",
    },
    itemName: {
      color: palette.text,
      fontWeight: "600",
      fontSize: 14,
    },
    moreItemsText: {
      color: palette.muted,
      fontWeight: "600",
      fontSize: 13,
      opacity: 0.6
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
