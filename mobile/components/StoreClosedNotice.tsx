import { View } from "react-native";
import Text from "./Text";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";

export type OpeningStatus = { isOpen: boolean; nextOpeningAt: string | null; timeZone: string };
export default function StoreClosedNotice({ status }: { status?: OpeningStatus | null }) {
  const { lang } = useI18n();
  const { palette } = useTheme();
  if (!status || status.isOpen) return null;
  const next = status.nextOpeningAt ? new Date(status.nextOpeningAt).toLocaleString(lang === "ar" ? "ar" : "en", {
    timeZone: status.timeZone, weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }) : null;
  const message = lang === "ar"
    ? next ? `المتجر مغلق الآن. سيتم البدء بخدمة طلبك عند أقرب موعد فتح: ${next} (${status.timeZone}).` : "المتجر مغلق الآن. سيتم البدء بخدمة طلبك في أقرب وقت ممكن. لا يوجد موعد فتح محدد حالياً."
    : next ? `The store is closed now. Your order will be served as soon as possible when we reopen: ${next} (${status.timeZone}).` : "The store is closed now. Your order will be served as soon as possible. No opening time is currently scheduled.";
  return <View accessibilityRole="alert" style={{ padding: 14, marginVertical: 8, borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: palette.surface }}><Text style={{ color: palette.text }}>{message}</Text></View>;
}
