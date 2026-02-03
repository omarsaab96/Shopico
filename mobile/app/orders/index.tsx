import { Link, useFocusEffect } from "expo-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  FlatList,
  TouchableOpacity,
  View,
  StyleSheet,
  RefreshControl,
  AppState,
} from "react-native";
import Screen from "../../components/Screen";
import Text from "../../components/Text";
import api from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { useRouter } from 'expo-router';


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

  const load = useCallback(async () => {
    if (!user) return;

    setRefreshing(true);
    try {
      const res = await api.get("/orders");
      const list = res.data.data || [];

      // newest first
      const sorted = [...list].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
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

    // setRefreshing(true);
    try {
      const res = await api.get("/orders");
      const list = res.data.data || [];

      // newest first
      const sorted = [...list].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );

      setOrders(sorted);
    } catch {
      setOrders([]);
    } finally {
      // setRefreshing(false);
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
          <Text style={styles.emptyText}>{t("loginToSeeOrders") ?? "Please login to view your orders."}</Text>

          <TouchableOpacity style={styles.browseBtn} onPress={() => { router.replace("/auth/login") }}>
            <Text style={styles.browseBtnText}>{t("login")}</Text>
          </TouchableOpacity>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>{t("noOrders") ?? "No orders yet"}</Text>
          <Text style={styles.emptyText}>{t("noOrdersHint") ?? "Start browsing to place your first order."}</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => router.replace("/(tabs)/store")}>
            <Text style={styles.browseBtnText}>{t("startBrowsing")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o._id}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
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
                <View>
                  <Text style={styles.name}>
                    #{item._id.slice(-6)}
                  </Text>

                  <Text style={styles.muted}>
                    {t(item.status) ?? item.status}
                  </Text>
                </View>

                <Text style={styles.value}>
                  {item.total?.toLocaleString()} SYP
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
      fontWeight: "800",
      marginBottom: 12,
       textAlign:'left'
    },

    row: {
      backgroundColor: palette.card,
      borderRadius: 20,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    name: { color: palette.text, fontWeight: "700" },
    muted: { color: palette.muted },
    value: { color: palette.accent, fontWeight: "800" },

    emptyBox: {
      backgroundColor: palette.card,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      gap: 8,
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
