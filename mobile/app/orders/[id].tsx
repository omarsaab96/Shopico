import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import Screen from "../../components/Screen";
import ProgressBar from "../../components/ProgressBar";
import api from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";

const steps = ["PENDING", "PROCESSING", "SHIPPING", "DELIVERED"];

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<any>();
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  useEffect(() => {
    api.get(`/orders/${id}`).then((res) => setOrder(res.data.data));
  }, [id]);

  if (!order) return null;
  const stepIndex = steps.indexOf(order.status);

  return (
    <Screen showBack backLabel={t("back") ?? "Back"}>
      <Text style={styles.title}>
        {t("order")} #{order._id?.slice(-6)}
      </Text>
      <ProgressBar progress={(stepIndex + 1) / steps.length} />
      <View style={styles.card}>
        <Text style={styles.muted}>{t("timeline")}</Text>
        <Text style={styles.value}>{order.status}</Text>
        <Text style={styles.muted}>
          {t("deliveryFee")}: {order.deliveryFee?.toLocaleString()} {t("syp")}
        </Text>
        <Text style={styles.muted}>
          {t("distance")}: {order.deliveryDistanceKm} {t("km")}
        </Text>
        <Text style={styles.total}>
          {t("total")}: {order.total?.toLocaleString()} {t("syp")}
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.muted}>{t("items")}</Text>
        {order.items?.map((item: any) => (
          <View key={item.product} style={styles.row}>
            <Text style={styles.value}>
              {item.quantity} x {item.product?.name || item.product}
            </Text>
            <Text style={styles.value}>{item.price.toLocaleString()}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    title: {
      color: palette.text,
      fontSize: 24,
      fontWeight: "900",
      marginBottom: 14,
    },

    card: {
      backgroundColor: palette.card,
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.border,
      marginTop: 14,
      gap: 8,
    },

    muted: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: "600",
    },

    value: {
      color: palette.text,
      fontWeight: "800",
      fontSize: 14,
    },

    total: {
      color: palette.accent,
      fontSize: 18,
      fontWeight: "900",
      marginTop: 8,
    },

    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 4,
    },
  });
