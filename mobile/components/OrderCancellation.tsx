import { useEffect, useState } from "react";
import { DeviceEventEmitter, TouchableOpacity, View } from "react-native";
import Text from "./Text";
import api from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";

type Props = { order: any; onUpdate: (order: any) => void; ordersPage: boolean };

export default function OrderCancellation({ order, onUpdate, ordersPage }: Props) {
  const { isRTL } = useI18n();
  const { palette } = useTheme();
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const end = Date.now() + Math.max(0, new Date(order?.cancellationUntil).getTime() - new Date(order?.serverTime || Date.now()).getTime());
    const tick = () => setRemaining(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [order]);

  const refund = order?.refunds?.find((entry: any) => entry.kind === "CUSTOMER_CANCELLATION");
  const pending = refund?.disposition === "WALLET" && refund.settlementStatus === "PENDING";
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => {
      void api.get(`/orders/${order._id}`).then(res => onUpdate(res.data.data)).catch(() => { });
    }, 5000);
    return () => clearInterval(timer);
  }, [pending, order?._id, onUpdate]);

  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const res = await api.post(`/orders/${order._id}/cancel`);
      onUpdate(res.data.data);
      DeviceEventEmitter.emit("shopico:notification", { type: "ORDER_STATUS" });
    } catch (err: any) {
      setError(err?.response?.data?.message || (isRTL ? "تعذر إلغاء الطلب. حاول مرة أخرى." : "Unable to cancel. Please try again."));
    } finally { setBusy(false); }
  }

  if (order?.cancelledByCustomer) return (
    <View style={{ padding: ordersPage ? 0 : 16, gap: ordersPage ? 4 : 8,borderTopWidth:ordersPage?1:0,marginTop:ordersPage?10:0,paddingTop:ordersPage?10:0,borderTopColor:'#009933',flexDirection:ordersPage?'row':'column' }}>
      <Text style={{ color: palette.text, textAlign: 'center' }}>
        {isRTL ? "تم إلغاء الطلب." : "Order cancelled."}
      </Text>

      {refund?.disposition === "WALLET" &&
        <Text style={{ color: palette.text, textAlign: 'center' }}>
          {pending
            ? (isRTL ? "استرداد المبلغ إلى المحفظة قيد التنفيذ" : "Wallet refund pending")
            : (isRTL ? "تمت إعادة المبلغ إلى محفظتك" : "Payment returned to your wallet")}
        </Text>
      }
    </View>
  );

  if (order?.status !== "PENDING" || !remaining) return null;

  return (
    <View style={{ padding: 16, gap: 10, backgroundColor: palette.card, borderRadius: 12 }}>
      {/* <Text style={{ color: palette.text }}></Text> */}
      {/* <Text style={{ color: palette.muted }}>{isRTL ? "سيُرسل الطلب إلى المتجر بعد انتهاء المهلة." : "Your order will be sent to the store when this window ends."}</Text> */}
      {/* {confirming && <Text style={{ color: palette.text }}>{order.paymentMethod === "WALLET"
        ? (isRTL ? "إلغاء الطلب وإعادة المبلغ إلى المحفظة؟" : "Cancel this order and return the payment to your wallet?")
        : (isRTL ? "هل تريد إلغاء الطلب؟" : "Cancel this order?")}</Text>} */}
      <View style={{ flexDirection: "row", alignItems: "stretch", gap: 10 }}>
        <TouchableOpacity disabled={busy} onPress={() => confirming ? void cancel() : setConfirming(true)} accessibilityRole="button"
          style={{ flexDirection: 'row', gap: 4, flex: 1, alignItems: 'baseline', justifyContent: "center", padding: 6, borderRadius: 10, borderWidth: 1, borderColor: palette.border, opacity: busy ? 0.5 : 1 }}>
          <Text style={{ color: palette.text, textAlign: "center", fontWeight: "700" }}>
            {busy ?
              (isRTL ? "جارٍ الإلغاء…" : "Cancelling…")
              : confirming ?
                (isRTL ? "تأكيد الإلغاء" : "Confirm cancellation")
                : (isRTL ? "إلغاء الطلب" : "Cancel order")}
          </Text>
          <Text style={{ color: palette.text, textAlign: "center" }}>
            •
          </Text>
          <Text style={{ color: palette.text, textAlign: "center", fontWeight: "700" }}>
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
          </Text>
        </TouchableOpacity>

        {confirming && !busy && <TouchableOpacity accessibilityRole="button" style={{ justifyContent: "center", padding: 6, borderRadius: 10, borderWidth: 1, borderColor: palette.border, maxWidth: "40%" }} onPress={() => setConfirming(false)}><Text style={{ color: palette.text, textAlign: "center" }}>
          {isRTL ? "الاحتفاظ بالطلب" : "Keep order"}</Text></TouchableOpacity>
        }
      </View>
      {!!error && <Text style={{ color: palette.text }}>{error}</Text>}
    </View>
  );
}
