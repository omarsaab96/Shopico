import Entypo from "@expo/vector-icons/Entypo";
import Feather from "@expo/vector-icons/Feather";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Text from "./Text";
import OrderMapPreview from "./OrderMapPreview";
import type { OrderPreview } from "../lib/orderPreview";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";

const statuses: Record<string, { color: string; background: string }> = {
  PENDING: { color: "#ff7a1f", background: "rgba(255,122,31,0.1)" },
  PROCESSING: { color: "#2563eb", background: "rgba(37,99,235,0.1)" },
  SHIPPING: { color: "#4f46e5", background: "rgba(79,70,229,0.1)" },
};

export default function ActiveOrderCard({ order, statusLabel, onPress }: {
  order: OrderPreview; statusLabel: string; onPress?: () => void;
}) {
  const { palette } = useTheme();
  const { t, lang, isRTL } = useI18n();
  const status = statuses[order.status];
  if (!status) return null;
  const rawUpdated = [order.updatedAt, order.driverLocation?.updatedAt, order.createdAt]
    .find(value => value && Number.isFinite(Date.parse(value)));
  const updated = rawUpdated ? new Date(rawUpdated).toLocaleString(lang === "ar" ? "ar" : "en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }) : "—";
  return (
    <TouchableOpacity accessibilityRole={onPress ? "button" : undefined} disabled={!onPress} onPress={onPress} activeOpacity={0.85}
      style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>

      <View style={[styles.map, { borderColor: palette.border }]}>
        <OrderMapPreview order={order} />
      </View>

      <View style={[styles.content, { direction: isRTL ? "rtl" : "ltr" }]}>
        <View style={styles.heading}>
          
          <View style={styles.details}>
            <View style={styles.detailsHead}>
              <Text weight="bold" style={[styles.orderNumber, { color: palette.text }]}>{"\u2066"}#{order._id.slice(-6)}{"\u2069"}</Text>
              <View style={[styles.textSeperator,{backgroundColor: palette.text}]}></View>
              <Text weight="semibold" style={[styles.status, { color: palette.muted }]}>{statusLabel}</Text>
            </View>
            <Text style={[styles.meta, { color: palette.muted, textAlign: isRTL ? "right" : "left" }]}>
              {t("orderLastUpdated")} {"\u2068"}{updated}{"\u2069"}
            </Text>
          </View>
          <View style={[styles.statusIcon, { borderColor: status.color, backgroundColor: status.background }]}>
            {order.status === "PENDING" ? <Entypo name="dots-three-horizontal" size={14} color={status.color} />
              : order.status === "PROCESSING" ? <Feather name="loader" size={17} color={status.color} />
                : <MaterialIcons name="delivery-dining" size={18} color={status.color} />}
          </View>
        </View>
      </View>
      {onPress && <View style={styles.linkArrow}>
        <Feather name={isRTL ? "arrow-left" : "arrow-right"} size={18} color={palette.accent} />
      </View>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { direction: "ltr", flexDirection: "row", alignItems:'center',borderWidth: 1, borderRadius: 15, overflow: "hidden", padding: 5, gap: 10 },
  map: { width: 60, height: 60, borderRadius: 15, overflow: "hidden" },
  content: { flex: 1, gap: 10},
  linkArrow: { paddingHorizontal: 4, justifyContent: "center" },
  heading: { flexDirection: "row", gap: 8, alignItems: 'center' },
  statusIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  details: { flex: 1, gap: 0 },
  detailsHead: { gap: 10, flexDirection: 'row', alignItems:'center'},
  orderNumber: { fontSize: 14, lineHeight: 18, writingDirection: "ltr" },
  status: { fontSize: 12, lineHeight: 18 },
  meta: { fontSize: 12, lineHeight: 18 },
  textSeperator: { width: 3, height: 3, borderRadius: 20 },
});
