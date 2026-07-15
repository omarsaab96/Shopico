import { useMemo, useRef } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider, BottomSheetView } from "@gorhom/bottom-sheet";
import Feather from "@expo/vector-icons/Feather";
import Text from "./Text";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";

const languages = [
  { code: "en", label: "English" },
  { code: "ar", label: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629" },
] as const;

export default function AuthLanguageSheet() {
  const sheetRef = useRef<BottomSheetModal>(null);
  const { lang, setLang, t, isRTL } = useI18n();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);
  const renderBackdrop = useMemo(
    () => (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    []
  );

  const selectLanguage = (code: "en" | "ar") => {
    setLang(code);
    sheetRef.current?.dismiss();
  };

  return (
    <BottomSheetModalProvider>
      <View style={styles.wrap}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => sheetRef.current?.present()}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t("language")}
        >
          <Feather name="globe" size={20} color={palette.text} />
        </TouchableOpacity>
      </View>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["28%"]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: palette.card, borderRadius: 20 }}
        handleIndicatorStyle={{ backgroundColor: palette.muted }}
      >
        <BottomSheetView style={styles.sheetContainer}>
          <Text weight="bold" style={styles.sheetTitle}>{t("language")}</Text>
          {languages.map((item) => {
            const active = lang === item.code;
            return (
              <TouchableOpacity
                key={item.code}
                style={[styles.option, active && styles.optionActive]}
                onPress={() => selectLanguage(item.code)}
                activeOpacity={0.85}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{item.label}</Text>
                {active ? <Feather name="check" size={18} color={palette.accent} /> : null}
              </TouchableOpacity>
            );
          })}
        </BottomSheetView>
      </BottomSheetModal>
    </BottomSheetModalProvider>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    wrap: {
      // alignItems: "flex-end",
      // zIndex: 2,
      // marginBottom: 8,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    sheetContainer: {
      paddingHorizontal: 18,
      paddingBottom: 24,
      gap: 10,
    },
    sheetTitle: {
      color: palette.text,
      fontSize: 18,
      textAlign: isRTL ? "right" : "left",
      marginBottom: 4,
    },
    option: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      backgroundColor: palette.surface,
      paddingVertical: 14,
      paddingHorizontal: 14,
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    optionActive: {
      borderColor: palette.accent,
    },
    optionText: {
      color: palette.text,
      fontWeight: "700",
    },
    optionTextActive: {
      color: palette.accent,
    },
  });
