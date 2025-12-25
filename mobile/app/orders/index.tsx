import { Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import Screen from "../../components/Screen";
import api from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  useEffect(() => {
    api.get("/orders").then((res) => setOrders(res.data.data || []));
  }, []);

  return (
    <Screen>
      <Text style={styles.title}>{t("orders")}</Text>
      <FlatList
        data={orders}
        keyExtractor={(o) => o._id}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
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
  });
