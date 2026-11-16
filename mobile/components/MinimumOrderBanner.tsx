import Feather from "@expo/vector-icons/Feather";
import { StyleSheet, View } from "react-native";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { useCurrency } from "../lib/currency";
import { roundAmount } from "../lib/productUnits";
import Text from "./Text";
import Money from "./Money";

export default function MinimumOrderBanner({ subtotal, minimum }: { subtotal: number; minimum: number }) {
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const { selectedCurrency, formatMoney } = useCurrency();
  const amountToAdd = roundAmount(Math.max(0, minimum - subtotal));
  const message = t("minimumOrderAddAmount").replace("{amount}", `\u2068${formatMoney(amountToAdd, selectedCurrency)}\u2069`);
  const progress = minimum > 0 ? Math.max(0, Math.min(1, subtotal / minimum)) : 0;
  const align = isRTL ? "right" : "left";
  return (
    <View accessibilityLiveRegion="polite" style={[styles.banner, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.top}>
        <View style={styles.icon}>
          <Feather name="lock" size={18} color={palette.muted} />
        </View>
        <View style={[styles.content,{}]}>
          <Text weight="bold" style={{ color: palette.text, fontSize: 12, lineHeight: 18, textAlign: align }}>
            {t("minimumOrderRequired")}
            {": "}<Money weight="bold" style={{ color: palette.text, fontSize: 12, lineHeight: 18 }} amount={minimum} currency={selectedCurrency} />
          </Text>

          <Text weight="semibold" style={{ color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: align,marginBottom:5 }}>{message}</Text>

          <View accessibilityRole="progressbar" accessibilityLabel={t("minimumOrderRequired")}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
            style={[styles.progressTrack, { backgroundColor: palette.border, alignItems: isRTL ? "flex-end" : "flex-start" }]}>
            <View style={{ height: 4, borderRadius: 999, backgroundColor: palette.accent, width: `${progress * 100}%` }} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderTopLeftRadius: 12,borderTopRightRadius: 12, padding: 8,marginHorizontal:10,borderWidth:1,borderBottomWidth:0},
  top: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  icon: { paddingTop: 1 },
  content: { flex: 1, gap: 0 },
  progressTrack: { borderRadius: 999, overflow: "hidden", direction: "ltr" },
});
