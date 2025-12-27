import { Link } from "expo-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { FlatList, Text, TouchableOpacity, View, StyleSheet, RefreshControl } from "react-native";
import Screen from "../../components/Screen";
import api from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const { user } = useAuth();
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  const load = useCallback(() => {
    if (!user) return;
    api.get("/orders")
      .then((res) => setOrders(res.data.data || []))
      .catch(() => setOrders([]));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <Text style={styles.title}>{t("orders")}</Text>
      {!user ? (
        <View style={styles.emptyBox}>
          <Text style={styles.muted}>{t("loginToSeeOrders") ?? "Please login to view your orders."}</Text>
          <Link href="/auth/login" asChild>
            <TouchableOpacity style={styles.loginBtn}>
              <Text style={styles.loginBtnText}>{t("login")}</Text>
            </TouchableOpacity>
          </Link>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o._id}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={palette.accent} />}
          renderItem={({ item }) => (
            <Link href={`/orders/${item._id}`} asChild>
              <TouchableOpacity style={styles.row}>
                <View>
                  <Text style={styles.name}>#{item._id.slice(-6)}</Text>
                  <Text style={styles.muted}>{item.status}</Text>
                </View>
                <Text style={styles.value}>{item.total?.toLocaleString()} SYP</Text>
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
    title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12, textAlign: isRTL ? "right" : "left" },
    row: {
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    name: { color: palette.text, fontWeight: "700" },
    muted: { color: palette.muted },
    value: { color: palette.accent },
    emptyBox: {
      backgroundColor: palette.card,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      gap: 12,
    },
    loginBtn: {
      backgroundColor: palette.accent,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
    },
    loginBtnText: { color: "#fff", fontWeight: "700" },
  });
