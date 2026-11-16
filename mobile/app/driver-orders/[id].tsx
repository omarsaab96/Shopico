import { formatQuantity } from "../../lib/productUnits";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, AppState, DeviceEventEmitter, Platform, ScrollView, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Screen from "../../components/Screen";
import ActiveDriverDeliveryBanner, { type ActiveDriverDelivery } from "../../components/ActiveDriverDeliveryBanner";
import Text from "../../components/Text";
import api from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { useTheme } from "../../lib/theme";
import { startDriverDelivery, reconcileDriverDelivery } from "../../lib/driverDelivery";
import { driverDeliveryAction } from "../../lib/driverOrderGroups";
import { startDriverTracking, stopDriverTracking } from "../../lib/driverTracking";

export default function DriverOrderDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const { palette } = useTheme();
  const router = useRouter();
  const ar = lang === "ar";
  const [activeDelivery, setActiveDelivery] = useState<ActiveDriverDelivery | null>(null);
  const hasOtherDelivery = Boolean(activeDelivery && activeDelivery._id !== id);
  const [deliveryAvailabilityLoaded, setDeliveryAvailabilityLoaded] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [unassigned, setUnassigned] = useState(false);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    if (!id || user?.role !== "driver") { setLoading(false); return; }
    try {
      const [res, assigned] = await Promise.all([api.get(`/orders/${id}`), api.get("/orders/driver")]);
      setActiveDelivery((assigned.data.data || []).map((item: any) => reconcileDriverDelivery(item)).find((item: ActiveDriverDelivery) => item.status === "SHIPPING" && item.driverStartedAt) || null);
      setDeliveryAvailabilityLoaded(true);
      const snapshot = reconcileDriverDelivery(res.data.data);
      setOrder(snapshot); setMessage(""); setUnassigned(false);
      if (["CANCELLED", "DELIVERED"].includes(snapshot.status)) await stopDriverTracking(id).catch(() => {});
    } catch (error: any) {
      setDeliveryAvailabilityLoaded(false);
      if ([403, 404].includes(error.response?.status)) {
        setOrder(null); setUnassigned(true);
        setMessage(ar ? "هذا الطلب لم يعد مسنداً إليك." : "This order is no longer assigned to you.");
        await stopDriverTracking(id).catch(() => {});
      } else setMessage(ar ? "تعذر تحميل الطلب. حاول مجدداً." : "Could not load order. Please retry.");
    } finally { setLoading(false); }
  }, [id, user?.role, ar]);
  useEffect(() => {
    void load();
    const notification = DeviceEventEmitter.addListener("shopico:notification", () => { void load(); });
    const appState = AppState.addEventListener("change", state => { if (state === "active") void load(); });
    const timer = setInterval(() => { if (AppState.currentState === "active") void load(); }, 15000);
    return () => { notification.remove(); appState.remove(); clearInterval(timer); };
  }, [load]);
  const update = async (status: "SHIPPING" | "DELIVERED") => {
    if (saving || unassigned) return;
    if (status === "SHIPPING" && (!deliveryAvailabilityLoaded || hasOtherDelivery)) return;
    setSaving(true); setMessage("");
    try {
      const saved = status === "SHIPPING" ? await startDriverDelivery(id)
        : reconcileDriverDelivery((await api.put(`/orders/${id}/driver-status`, { status })).data.data);
      setOrder((current: any) => ({ ...current, ...saved }));
      DeviceEventEmitter.emit("shopico:notification");
      if (status === "SHIPPING" && Platform.OS !== "web") {
        try { await startDriverTracking(id); }
        catch { Alert.alert(ar ? "بدأ التوصيل" : "Delivery started", ar ? "حالة الطلب الآن قيد الشحن. اسمح بالموقع لتفعيل التتبع." : "The order is now shipping. Allow location access to enable tracking."); }
      }
      if (status === "DELIVERED") await stopDriverTracking(id).catch(() => {});
      if (status === "SHIPPING") {
        router.push({ pathname: "/driver-directions/[id]", params: { id } });
        void load();
      } else await load();
    } catch (error: any) { await load(); Alert.alert(ar ? "تعذر تحديث الطلب" : "Could not update order", error?.code === "DELIVERY_START_NOT_CONFIRMED" ? t("driverStartNotConfirmed") : error.response?.data?.code === "DRIVER_ALREADY_DELIVERING" ? t("driverOneDeliveryAtATime") : error.response?.data?.message || (ar ? "حاول مجدداً." : "Please retry.")); }
    finally { setSaving(false); }
  };
  const button = { padding: 16, borderRadius: 12, backgroundColor: palette.accent, alignItems: "center" as const, opacity: saving ? 0.5 : 1 };
  const deliveryAction = driverDeliveryAction(order);
  const completed = order?.status === "DELIVERED";
  const cancelled = order?.status === "CANCELLED";
  return <Screen showBack backLabel={ar ? "رجوع" : "Back"}>
    <ActiveDriverDeliveryBanner order={activeDelivery} currentOrderId={id} />
    <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 30 }}>
      {Platform.OS === "android" && <Text style={{ color: palette.muted }}>{t("driverTrackingForeground")}</Text>}
      <Text style={{ color: palette.text, fontSize: 24, fontWeight: "800" }}>{ar ? "تفاصيل الطلب" : "Order details"} #{String(id || "").slice(-6)}</Text>
      {loading && <ActivityIndicator color={palette.accent} />}
      {message ? <View accessibilityRole="alert" style={{ padding: 16, backgroundColor: palette.card, borderRadius: 12 }}><Text style={{ color: palette.text }}>{message}</Text>{!unassigned && <TouchableOpacity onPress={() => void load()}><Text style={{ color: palette.accent }}>{ar ? "إعادة المحاولة" : "Retry"}</Text></TouchableOpacity>}</View> : null}
      {user?.role !== "driver" && <Text>{ar ? "هذه الصفحة للسائقين فقط." : "This page is for drivers."}</Text>}
      {order && !unassigned && <>
        <Text style={{ fontWeight: "700", color: cancelled ? "#dc2626" : completed ? "#16a34a" : palette.accent }}>{cancelled ? (ar ? "تم إلغاء هذا الطلب." : "This order has been cancelled.") : completed ? (ar ? "مكتمل" : "Completed") : order.status === "SHIPPING" ? t(order.driverStartedAt ? "driverDeliveryStarted" : "driverReadyToDeliver") : t(order.status)}</Text>
        <View style={{ padding: 18, gap: 10, borderRadius: 14, backgroundColor: palette.card }}><Text style={{ color: palette.text, fontWeight: "700" }}>{order.user?.name || (ar ? "العميل" : "Customer")}</Text>{order.user?.phone && <Text style={{ color: palette.text }}>{order.user.phone}</Text>}<Text style={{ color: palette.text }}>{order.address}</Text>{order.notes && <Text style={{ color: palette.muted }}>{order.notes}</Text>}</View>
        <View style={{ padding: 18, gap: 12, borderRadius: 14, backgroundColor: palette.card }}>{(order.items || []).map((item: any, index: number) => <View key={index} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><Text style={{ color: palette.text, flex: 1 }}>{typeof item.product === "object" ? item.product?.name : (ar ? "منتج" : "Item")}</Text><Text style={{ color: palette.text }}>× {formatQuantity(item.quantity - (item.refundedQuantity || 0), item, ar)}</Text></View>)}<Text style={{ color: palette.text, fontWeight: "700" }}>{ar ? "الإجمالي" : "Total"}: {order.total} {order.currency?.symbol?.[ar ? "ar" : "en"] || order.currency?.symbol?.en || ""}</Text></View>
        {!cancelled && !completed && <>
          {deliveryAction === "start" && <TouchableOpacity disabled={saving || hasOtherDelivery || !deliveryAvailabilityLoaded} style={[button, (hasOtherDelivery || !deliveryAvailabilityLoaded) && { opacity: 0.5 }]} onPress={() => void update("SHIPPING")}><Text style={{ color: "#fff", fontWeight: "700" }}>{hasOtherDelivery ? t("driverOneDeliveryAtATime") : ar ? "بدء التوصيل" : "Start delivery"}</Text></TouchableOpacity>}
          {deliveryAction === "deliver" && <TouchableOpacity disabled={saving} style={button} onPress={() => void update("DELIVERED")}><Text style={{ color: "#fff", fontWeight: "700" }}>{t("markDelivered")}</Text></TouchableOpacity>}
          <TouchableOpacity style={{ padding: 16 }} onPress={() => router.push({ pathname: "/driver-directions/[id]", params: { id } } as any)}><Text style={{ color: palette.accent }}>{ar ? "عرض الاتجاهات" : "View directions"}</Text></TouchableOpacity>
        </>}
      </>}
    </ScrollView>
  </Screen>;
}
