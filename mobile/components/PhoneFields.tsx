import { useMemo, useState } from "react";
import { FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCountries, getCountryCallingCode, type CountryCode } from "../lib/phone";
import names from "../lib/phoneCountries.json";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import Text from "./Text";
import { TextInput } from "./TextInput";

type Props = {
  country: CountryCode;
  onCountryChange: (country: CountryCode) => void;
  phone: string;
  onPhoneChange: (phone: string) => void;
  confirmPhone?: string;
  onConfirmPhoneChange?: (phone: string) => void;
};

export default function PhoneFields({ country, onCountryChange, phone, onPhoneChange, confirmPhone, onConfirmPhoneChange }: Props) {
  const { palette } = useTheme();
  const { t, lang, isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const countryName = (code: CountryCode) => names[code]?.[lang] || names[code]?.en || code;
  const countries = useMemo(() => getCountries().sort((a, b) => countryName(a).localeCompare(countryName(b), lang)), [lang]);
  const filtered = countries.filter(code => `${countryName(code)} ${code} +${getCountryCallingCode(code)}`.toLowerCase().includes(search.trim().toLowerCase()));
  const inputStyle = { backgroundColor: palette.surface, color: palette.text, borderColor: palette.border, borderWidth: 1, borderRadius: 12, padding: 12 };
  return (
    <View style={{ gap: 10 }}>
      <Text weight="bold" style={{ color: palette.text }}>{t("phone")}</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("phoneCountry")}
        onPress={() => { Keyboard.dismiss(); setSearch(""); setOpen(true); }}
        style={[inputStyle, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }]}>
        <Text style={{ color: palette.text, flex: 1 }}>{countryName(country)} ({`+${getCountryCallingCode(country)}`})</Text>
        <Feather name="chevron-down" size={18} color={palette.muted} />
      </TouchableOpacity>
      <TextInput style={[inputStyle, styles.number]} value={phone} onChangeText={onPhoneChange}
        placeholder={t("phone")} accessibilityLabel={t("phone")} placeholderTextColor={palette.muted}
        keyboardType="phone-pad" autoComplete="tel-national" maxLength={64} />
      {onConfirmPhoneChange && <TextInput style={[inputStyle, styles.number]} value={confirmPhone} onChangeText={onConfirmPhoneChange}
        placeholder={t("confirmPhone")} accessibilityLabel={t("confirmPhone")} placeholderTextColor={palette.muted}
        keyboardType="phone-pad" autoComplete="off" maxLength={64} />}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top + 16, paddingBottom: insets.bottom }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text weight="bold" style={{ color: palette.text, fontSize: 20 }}>{t("phoneCountry")}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={t("close")} style={{ padding: 10 }}>
                <Feather name="x" size={24} color={palette.text} />
              </TouchableOpacity>
            </View>
            <TextInput style={inputStyle} value={search} onChangeText={setSearch} placeholder={t("searchCountries")}
              accessibilityLabel={t("searchCountries")} placeholderTextColor={palette.muted} autoCorrect={false} />
          </View>
          <FlatList data={filtered} keyExtractor={code => code} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={<Text style={{ color: palette.muted }}>{t("noCountriesFound")}</Text>}
            renderItem={({ item }) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: item === country }}
              onPress={() => { onCountryChange(item); Keyboard.dismiss(); setOpen(false); }}
              style={{ paddingVertical: 15, flexDirection: "row", gap: 12, alignItems: "center", borderBottomWidth: 1, borderColor: palette.border }}>
              <Text style={{ flex: 1, color: palette.text, textAlign: isRTL ? "right" : "left" }}>{countryName(item)}</Text>
              <Text style={{ color: palette.muted, writingDirection: "ltr" }}>+{getCountryCallingCode(item)}</Text>
              {item === country && <Feather name="check" size={18} color={palette.accent} />}
            </TouchableOpacity>} />
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({ number: { textAlign: "left", writingDirection: "ltr", direction: "ltr" } });
