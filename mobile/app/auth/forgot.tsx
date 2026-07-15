import { Link, useRouter } from "expo-router";
import { useMemo, useState, useRef, useCallback } from "react";
import { TextInput, TouchableOpacity, Image, View, StyleSheet } from "react-native";
import Text from "../../components/Text";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { goBack } from "expo-router/build/global-state/routing";
import AuthLanguageSheet from "../../components/AuthLanguageSheet";
import Feather from "@expo/vector-icons/Feather";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider, BottomSheetView } from "@gorhom/bottom-sheet";

export default function Forgot() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { palette, isDark } = useTheme();
  const { lang, setLang, t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isDark, isRTL, insets), [palette, isDark, isRTL, insets]);
  const router = useRouter();
  const sheetRef = useRef<BottomSheetModal>(null);

  const languages = [
    { code: "en", label: "English" },
    { code: "ar", label: "العربية" },
  ] as const;

  const submit = () => {
    setSent(true);
  };

  // const goToLogin = () => {
  //   router.push("/auth/login");
  // }

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    []
  );

  const selectLanguage = (code: "en" | "ar") => {
    setLang(code);
    sheetRef.current?.dismiss();
  };

  return (
    <BottomSheetModalProvider>
      <View style={[styles.safe]} >
        <View style={styles.container}>

          <View style={{ flex: 1, justifyContent: 'space-between', position: 'relative' }}>
            <Image source={require('../../assets/watermark4.png')} style={styles.watermark} />

            <View style={{  }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <View style={{ width: 40 }}></View>
                <Image source={require('../../assets/shopico_logo-black.png')} style={styles.logo} />
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
              
              <View style={styles.hero}>
                <Text weight="bold" style={styles.title}>{t("forgotPassword")}</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.muted}>{t("resetCopy")}</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t("email")}
                  placeholderTextColor={palette.muted}
                  autoCapitalize="none"
                />
                {sent && <Text style={styles.success}>{t("resetSent")}</Text>}

              </View>
            </View>

            <View style={{ gap: 10 }}>
              <TouchableOpacity style={styles.cta} onPress={submit} >
                <Text style={styles.ctaText}>{t("sendLink")}</Text>
              </TouchableOpacity>

              {/* <Button title={t("sendLink")} onPress={submit} /> */}


              <View style={[styles.row, { justifyContent: 'center' }]}>
                <View style={{ flexDirection: 'row', gap: 5, alignItems: 'baseline' }}>
                  {/* <Text>{t("donthaveAnAccount")}</Text> */}
                  <TouchableOpacity onPress={goBack} >
                    <Text style={styles.link}>{t("cancel")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <BottomSheetModal
              ref={sheetRef}
              // snapPoints={["28%"]}
              enablePanDownToClose
              backdropComponent={renderBackdrop}
              backgroundStyle={{ backgroundColor: palette.card, borderRadius: 20 }}
              handleIndicatorStyle={{ backgroundColor: palette.muted }}
            >
              <BottomSheetView style={styles.sheetContainer}>
                <Text weight="bold" style={styles.sheetTitle}>{t("language")}</Text>
                <View style={{ flexDirection:'row', gap:10}}>
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
                      {/* {active ? <Feather name="check" size={18} color={palette.accent} /> : null} */}
                    </TouchableOpacity>
                  );
                })}
                </View>
              </BottomSheetView>
            </BottomSheetModal>

          </View>
        </View>
      </View>
    </BottomSheetModalProvider>
  );
}

const createStyles = (palette: any, isDark: any, isRTL: boolean, insets: any) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: palette.background,
      writingDirection: isRTL ? "rtl" : "ltr",
      direction: isRTL ? "rtl" : "ltr",
      // borderWidth:6
    },
    container: {
      flex: 1,
      paddingTop: insets.top + 15,
      paddingBottom: insets.bottom + 15,
      paddingHorizontal: 16,
      // paddingTop: 16,
      writingDirection: isRTL ? "rtl" : "ltr",
      direction: isRTL ? "rtl" : "ltr",
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
      paddingBottom: insets.bottom + 10,
      gap: 10,
    },
    sheetTitle: {
      color: palette.text,
      fontSize: 18,
      marginBottom: 4,
      // borderWidth:1,
      textAlign:'center'
    },
    option: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      backgroundColor: palette.surface,
      paddingVertical: 14,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flex:1,
      gap:10
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
    logo: {
      width: 100,
      height: 100,
      objectFit: 'contain'
    },
    hero: { gap: 6, marginBottom: 18 },
    kicker: { color: palette.accent, textAlign: "left" },
    title: {
      color: palette.text, fontSize: 22,
    },
    watermark: {
      position: 'absolute',
      top: 0,
      right: -20,
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      // borderWidth:3
      opacity: 0.4,
      pointerEvents: 'none',
    },
    card: {
      gap: 12,
    },
    cardTitle: { color: palette.text, fontSize: 18, textAlign: isRTL ? "right" : "left" },
    muted: { color: palette.muted },
    input: {
      backgroundColor: palette.surface,
      color: palette.text,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    link: { color: palette.accent },
    cta: {
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: palette.accent,
      shadowColor: palette.accent,
      shadowOpacity: isDark ? 0.3 : 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 10
    },
    ctaText: {
      color: "#fff", fontSize: 16, fontWeight: "700"
    },
    success: { color: "#22c55e" },
    row: { flexDirection: "row", justifyContent: "space-between" },
  });
