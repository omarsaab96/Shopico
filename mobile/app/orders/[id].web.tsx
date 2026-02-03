import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import Text from "../../components/Text";
import api from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";

export default function OrderDetailWeb() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    api.get(`/orders/${id}`).then((res) => setOrder(res.data.data));
  }, [id]);

  if (!order) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name={isRTL ? "chevron-right" : "chevron-left"} size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("order")} #{order._id.slice(-6)}</Text>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          {t("mapNotSupported") ?? "Map preview is not available on web."}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("status") ?? "Status"}</Text>
          <Text style={styles.sectionValue}>{t(order.status) ?? order.status}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("delivery") ?? "Delivery"}</Text>
          <Text style={styles.sectionValue}>{order.address}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("items") ?? "Items"}</Text>
          {order.items.map((item: any) => (
            <View key={item.product} style={styles.itemRow}>
              <Text style={styles.itemName}>
                {item.quantity} x {item.product?.name || item.product}
              </Text>
              <Text style={styles.itemPrice}>{item.price.toLocaleString()}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 10,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: palette.card,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },
    title: { color: palette.text, fontSize: 18, fontWeight: "800" },
    notice: {
      margin: 16,
      padding: 12,
      borderRadius: 12,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    noticeText: { color: palette.muted, fontSize: 12, fontWeight: "600" },
    content: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
    card: {
      backgroundColor: palette.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
      gap: 8,
    },
    sectionTitle: { color: palette.muted, fontSize: 12, fontWeight: "700" },
    sectionValue: { color: palette.text, fontSize: 14, fontWeight: "700" },
    itemRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
    itemName: { color: palette.text, fontWeight: "700" },
    itemPrice: { color: palette.text, fontWeight: "800" },
  });
