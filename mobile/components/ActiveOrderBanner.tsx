import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { AppState, DeviceEventEmitter, TouchableOpacity, View } from "react-native";
import Text from "./Text";
import { useTheme } from "../lib/theme";
import ActiveOrderCard from "./ActiveOrderCard";
import api from "../lib/api";
import { selectActiveOrder, type ActiveOrder } from "../lib/activeOrder";
import { useAuth } from "../lib/auth";
import { useCurrency } from "../lib/currency";
import { useI18n } from "../lib/i18n";

export default function ActiveOrderBanner({ branchId, orders: providedOrders }: { branchId?: string; orders?: readonly ActiveOrder[] }) {
  const { user } = useAuth();
  const { selectedCurrency } = useCurrency();
  const { t, isRTL } = useI18n();
  const { palette, isDark } = useTheme();
  const router = useRouter();
  const isDriver = user?.role === "driver";
  const scope = `${user?._id || ""}:${user?.role || ""}:${branchId || ""}:${selectedCurrency?._id || ""}`;
  const [state, setState] = useState<{ scope: string; order: ActiveOrder | null }>({ scope: "", order: null });

  useFocusEffect(useCallback(() => {
    if (!user || providedOrders) return;
    let active = true;
    let pending = false;
    const load = async () => {
      if (pending || AppState.currentState !== "active") return;
      pending = true;
      try {
        const res = await api.get(isDriver ? "/orders/driver" : "/orders", isDriver ? undefined : { params: { currencyId: selectedCurrency?._id } });
        const orders: ActiveOrder[] = res.data.data || [];
        const order = selectActiveOrder(orders, isDriver);
        if (active) setState({ scope, order });
      } catch { /* Keep the current order visible during a temporary connection failure. */ }
      finally { pending = false; }
    };
    void load();
    const notification = DeviceEventEmitter.addListener("shopico:notification", () => { void load(); });
    const appState = AppState.addEventListener("change", next => { if (next === "active") void load(); });
    const timer = setInterval(() => { void load(); }, 15000);
    return () => { active = false; notification.remove(); appState.remove(); clearInterval(timer); };
  }, [user?._id, isDriver, scope, selectedCurrency?._id, providedOrders]));

  const order = providedOrders ? selectActiveOrder(providedOrders, isDriver) : state.scope === scope ? state.order : null;
  if (!user || !order) return null;
  const statusLabel = t(isDriver && order.status === "SHIPPING"
    ? order.driverStartedAt ? "driverDeliveryInProgress" : "driverReadyToDeliver"
    : order.status === "SHIPPING" ? "orderOnTheWay" : order.status);
  const statusIcon = order.status === "SHIPPING" ? "delivery-dining"
    : order.status === "PROCESSING" ? "restaurant" : "schedule";
  const cardColors = !isDriver && order.status === "PENDING"
    ? { border: "#ff7a1f", heading: isDark ? "#fdba74" : "#c2410c", background: isDark ? "#35261e" : "#fff3e8" }
    : !isDriver && order.status === "PROCESSING"
      ? { border: "#2563eb", heading: isDark ? "#93c5fd" : "#2563eb", background: isDark ? "#1e293e" : "#eff6ff" }
      : { border: "#4f46e5", heading: isDark ? "#c4b5fd" : "#4f46e5", background: isDark ? "#242239" : "#f0edff" };
  const headingColor = cardColors.heading;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text weight="black" style={{ color: palette.text, fontSize: 16, lineHeight: 30, textAlign: isRTL ? "right" : "left" }}>
          {t("yourLastOrder")}
        </Text>

        <TouchableOpacity accessibilityRole="button" activeOpacity={0.85}
          style={{ alignSelf: "center" }}
          onPress={() => router.push(isDriver ? "/(tabs)/driver" : "/(tabs)/orders")}>
          <Text weight="black" style={{ color: palette.accent }}>{t("viewAll")}</Text>
        </TouchableOpacity>
      </View>
      
      <View style={{ width: "100%", padding: 14, gap: 8, borderRadius: 16, borderWidth: 1,
        borderColor: cardColors.border, backgroundColor: cardColors.background }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <MaterialIcons name={statusIcon} size={20} color={headingColor} />
          <Text weight="black" style={{ color: headingColor, fontSize: 14, lineHeight: 20 }}>{statusLabel}</Text>
        </View>
        <ActiveOrderCard order={order} embedded
          statusLabel={statusLabel}
          onPress={() => router.push(isDriver ? `/driver-orders/${order._id}` : `/orders/${order._id}`)} />
      </View>
    </View>
  );
}
