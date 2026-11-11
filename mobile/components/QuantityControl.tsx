import { useEffect, useState } from "react";
import { TextInput, TouchableOpacity, View } from "react-native";
import Text from "./Text";
import { quantityStep, unitLabel, UnitProduct } from "../lib/productUnits";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

export default function QuantityControl({ quantity, product, onChange, onValidationChange, allowRemove = true, compact = false }: { quantity: number; product: UnitProduct; onChange: (quantity: number) => void; onValidationChange?: (valid: boolean) => void; allowRemove?: boolean; compact?: boolean }) {
  const { palette } = useTheme();
  const { isRTL } = useI18n();
  const [draft, setDraft] = useState(String(quantity));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setDraft(String(quantity)); setInvalid(false); onValidationChange?.(true); }, [quantity]);
  const step = quantityStep(product);
  const commit = () => {
    const value = Number(draft);
    if (!draft.trim() || !Number.isSafeInteger(value) || value < 1) { setInvalid(true); onValidationChange?.(false); return; }
    setInvalid(false);
    onValidationChange?.(true);
    onChange(value);
  };
  return <View style={{ gap: 4 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: compact ? 4 : 8 }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={isRTL ? "تقليل الكمية" : "Decrease quantity"} onPress={() => onChange(Math.max(allowRemove ? 0 : 1, quantity - step))} style={{ padding: compact ? 6 : 10 }}><Text style={{ color: palette.text, fontSize: 22 }}>−</Text></TouchableOpacity>
      <TextInput accessibilityLabel={isRTL ? "الكمية" : "Quantity"} value={draft} keyboardType="number-pad" selectTextOnFocus onChangeText={text => {
        const normalized = text.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776));
        setDraft(normalized);
        const value = Number(normalized);
        const valid = normalized.trim() !== "" && Number.isSafeInteger(value) && value > 0;
        setInvalid(!valid);
        onValidationChange?.(valid);
        if (valid) onChange(value);
      }} onBlur={commit} onSubmitEditing={commit} style={{ color: palette.text, textAlign: "center", minWidth: compact ? 44 : 58, maxWidth: compact ? 70 : 95, padding: compact ? 4 : 8, borderWidth: 1, borderColor: palette.border, borderRadius: 8 }} />
      <Text style={{ color: palette.text }}>{unitLabel(product, isRTL)}</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={isRTL ? "زيادة الكمية" : "Increase quantity"} onPress={() => onChange(quantity + step)} style={{ padding: compact ? 6 : 10 }}><Text style={{ color: palette.text, fontSize: 22 }}>+</Text></TouchableOpacity>
    </View>
    {invalid && <Text style={{ color: palette.text }}>{isRTL ? "أدخل كمية صحيحة أكبر من صفر" : "Enter a whole quantity greater than zero"}</Text>}
  </View>;
}
