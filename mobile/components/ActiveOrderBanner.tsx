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
  const { palette } = useTheme();
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
      
      <ActiveOrderCard order={order}
        statusLabel={t(isDriver && order.status === "SHIPPING" ? order.driverStartedAt ? "driverDeliveryInProgress" : "driverReadyToDeliver" : order.status)}
        onPress={() => router.push(isDriver ? `/driver-orders/${order._id}` : `/orders/${order._id}`)} />
    </View>
  );
}
