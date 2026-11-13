import { TextInput } from "./TextInput";
import { resolveFont } from "../lib/typography";
import AntDesign from "@expo/vector-icons/AntDesign";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useEffect, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import Text from "./Text";
import { quantityStep, quantityDisplayScale, formatQuantity, unitLabel, UnitProduct } from "../lib/productUnits";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

export default function QuantityControl({ quantity, product, onChange, onValidationChange, allowRemove = true, compact = false, pill = false, fullwidth = false, incart = false }: { quantity: number; product: UnitProduct; onChange: (quantity: number) => void; onValidationChange?: (valid: boolean) => void; allowRemove?: boolean; compact?: boolean; pill?: boolean; fullwidth?: boolean; incart?: boolean }) {
  const { palette } = useTheme();
  const { isRTL } = useI18n();
  const [editing, setEditing] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [editingScale, setEditingScale] = useState(1);
  const scale = editing ? editingScale : quantityDisplayScale(quantity, product);
  const [draft, setDraft] = useState(String(quantity / quantityDisplayScale(quantity, product)));
  const [invalid, setInvalid] = useState(false);
  const editTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ quantity, onChange });
  latest.current = { quantity, onChange };
  const cancelPendingEdit = () => {
    if (editTimer.current !== null) {
      clearTimeout(editTimer.current);
      editTimer.current = null;
    }
  };
  useEffect(() => () => cancelPendingEdit(), []);
  useEffect(() => {
    if (editing) return;
    setDraft(String(quantity / scale));
    setInvalid(false);
    onValidationChange?.(true);
  }, [quantity, scale, editing]);
  const step = quantityStep(product);
  const removesItem = allowRemove && quantity <= step;
  const commit = () => {
    cancelPendingEdit();
    const value = Math.round(Number(draft) * scale * 1e8) / 1e8;
    if (!draft.trim() || !Number.isSafeInteger(value) || value < 1) { setInvalid(true); onValidationChange?.(false); return; }
    setInvalid(false);
    onValidationChange?.(true);
    if (value !== latest.current.quantity) latest.current.onChange(value);
  };
  return <View style={{
    gap: 4,
    ...(pill && { alignSelf: 'flex-start' as const }),
    ...(fullwidth && { width: '100%' as const })
  }}>
    <View style={{
      backgroundColor: '#fff',
      flexDirection: "row",
      alignItems: "center",
      gap: pill ? 10 : compact ? 2 : 8,
      ...(pill && { borderWidth: 1, borderColor: palette.border, borderRadius: 30, paddingHorizontal: 10, paddingVertical: 4 }),
    }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={removesItem ? (isRTL ? "إزالة من السلة" : "Remove from cart") : (isRTL ? "تقليل الكمية" : "Decrease quantity")}
        onPress={() => { cancelPendingEdit(); onChange(removesItem ? 0 : Math.max(allowRemove ? 0 : 1, quantity - step)); }}
        style={{ padding: pill ? 0 : compact ? 0 : 10 }}
      >
        {removesItem ?
          <FontAwesome name="trash-o" size={pill ? 22 : 20} color={palette.text} />
          :
          pill ?
            <AntDesign name="minus" size={18} color={palette.text} />
            :
            <Text style={{ color: palette.text, fontSize: 22 }}>−</Text>
        }
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', alignItems: 'center', ...(pill ? !incart ? { flex: 1, gap: 4 } : { gap: 4 } : { flex: 1 }), justifyContent: 'center' }}>
        {editing ?
          <TextInput
            autoFocus
            accessibilityLabel={isRTL ? "الكمية" : "Quantity"}
            value={draft}
            keyboardType={scale === 1000 ? "decimal-pad" : "number-pad"}
            underlineColorAndroid="transparent"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            selectTextOnFocus={false}
            selection={selection}
            onSelectionChange={event => setSelection(event.nativeEvent.selection)}
            onChangeText={text => {
              const normalized = text.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776)).replace(/[٫,]/g, ".");
              setDraft(normalized);
              // Collapse the initial selection after replacement so later digits append.
              const cursor = Math.max(0, Math.min(normalized.length,
                selection.start + normalized.length - (draft.length - (selection.end - selection.start))));
              setSelection({ start: cursor, end: cursor });
              const value = Math.round(Number(normalized) * scale * 1e8) / 1e8;
              const valid = normalized.trim() !== "" && Number.isSafeInteger(value) && value > 0;
              setInvalid(!valid);
              onValidationChange?.(valid);
              cancelPendingEdit();
              if (valid) {
                editTimer.current = setTimeout(() => {
                  editTimer.current = null;
                  if (value !== latest.current.quantity) latest.current.onChange(value);
                }, 500);
              }
            }}
            onBlur={() => {
              commit();
              setEditing(false);
            }}
            onSubmitEditing={commit}
            style={{
              color: palette.text,
              textDecorationLine: "none",
              backgroundColor: "transparent",
              textAlign: "center",
              textAlignVertical: "center",
              height: pill ? 22 : 32,
              lineHeight: 22,
              includeFontPadding: false,
              fontFamily: resolveFont(isRTL, "black"),
              fontSize: 16,
              // width: Math.max(pill ? 30 : 44, Math.min(104, draft.length * 11 + (pill ? 0 : 16))),
              flexShrink: 0,
              // minWidth: pill ? 30 : compact ? 44 : 58,
              // maxWidth: 104,
              padding: pill ? 0 : compact ? 4 : 8,
              borderWidth: pill ? 0 : 1,
              borderColor: palette.border,
              borderRadius: 8
            }}
          /> : (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={isRTL ? "\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0643\u0645\u064a\u0629" : "Edit quantity"}
              onPress={() => {
                const initialDraft = String(quantity / scale);
                setDraft(initialDraft);
                setSelection({ start: 0, end: initialDraft.length });
                setEditingScale(scale);
                setEditing(true);
                setInvalid(false);
                onValidationChange?.(true);
              }}
              style={{
                minWidth: pill ? 30 : 44,
                minHeight: pill ? undefined : 32,
                alignItems: "center",
                justifyContent: "center"
              }}>
              <Text weight="black" style={{ color: palette.text, fontSize: 16, textDecorationLine: "none" }}>
                {formatQuantity(quantity, product, isRTL)}
              </Text>
            </TouchableOpacity>
          )}

        {editing && !!unitLabel(product, isRTL) &&
          <Text weight="black" style={{ color: palette.text, fontSize: 16 }}>
            {unitLabel(product, isRTL, scale === 1000)}
          </Text>
        }
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={isRTL ? "زيادة الكمية" : "Increase quantity"}
        onPress={() => {
          cancelPendingEdit();
          onChange(quantity + step);
        }}
        style={{ padding: pill ? 0 : compact ? 6 : 10 }}
      >
        {pill ? <AntDesign name="plus" size={20} color={palette.text} />
          :
          <Text style={{ color: palette.text, fontSize: 22 }}>+</Text>}
      </TouchableOpacity>
    </View>

    {/* {invalid &&
      <Text style={{ color: palette.text }}>
        {isRTL ? "أدخل كمية صحيحة أكبر من صفر" : "Enter a whole quantity greater than zero"}
      </Text>
    } */}

  </View>;
}
