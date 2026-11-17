import Feather from "@expo/vector-icons/Feather";
import { StyleSheet, View } from "react-native";
import Text from "./Text";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";

export type OpeningStatus = { isOpen: boolean; nextOpeningAt: string | null; timeZone: string };
export default function StoreClosedNotice({ status }: { status?: OpeningStatus | null }) {
  const { lang, isRTL } = useI18n();
  const { palette } = useTheme();
  if (!status || status.isOpen) return null;
  const next = status.nextOpeningAt ? new Date(status.nextOpeningAt).toLocaleString(lang === "ar" ? "ar" : "en", {
    timeZone: status.timeZone, weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }) : null;
  const message = lang === "ar"
    ? next ? `سيتم البدء بخدمة طلبك عند أقرب موعد فتح: ${next} بتوقيت ${status.timeZone=='Asia/Damascus'?'سوريا / الشام':'status.timeZone'}.` : "سيتم البدء بخدمة طلبك في أقرب وقت ممكن."
    : next ? `Your order will be served as soon as possible when we reopen: ${next} (${status.timeZone}).` : "Your order will be served as soon as possible.";
  const textAlign = isRTL ? "right" : "left";
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: palette.border, borderColor: palette.border }]}>
      <View style={styles.top}>
        <View style={styles.icon}>
          <Feather name="clock" size={18} color={palette.text} />
        </View>
        <View style={styles.content}>
          <Text weight="bold" style={{ color: palette.text, fontSize: 12, lineHeight: 18, textAlign }}>
            {lang === "ar" ? "المتجر مغلق الآن" : "The store is closed now"}
          </Text>
          <Text weight="semibold" style={{ color: palette.muted, fontSize: 12, lineHeight: 18, textAlign }}>{message}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 5, marginHorizontal: 10, borderWidth: 1, borderBottomWidth: 0 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  icon: { paddingTop: 1 },
  content: { flex: 1, gap: 0,paddingTop:2 },
});
