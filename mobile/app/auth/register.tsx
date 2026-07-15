import { Link, useRouter } from "expo-router";
import { useMemo, useState, useRef, useCallback } from "react";
import { TextInput, View, Image, StyleSheet, TouchableOpacity } from "react-native";
import Button from "../../components/Button";
import Text from "../../components/Text";
import api, { storeTokens } from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import AntDesign from '@expo/vector-icons/AntDesign';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider, BottomSheetView } from "@gorhom/bottom-sheet";
import Feather from "@expo/vector-icons/Feather";

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setUserProfile, logout } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { palette } = useTheme();
  const { t, lang, setLang, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL, insets), [palette, isRTL, insets]);
  const sheetRef = useRef<BottomSheetModal>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const languages = [
    { code: "en", label: "English" },
    { code: "ar", label: "العربية" },
  ] as const;

  const submit = async () => {
    if (name.trim() == "" || email.trim() == "" || password.trim() == "") {
      setError(t("invalidForm"));
      return;
    }
    try {
      const res = await api.post("/auth/register", { name, email, password });
      const { accessToken, refreshToken, user } = res.data.data;
      await storeTokens(accessToken, refreshToken);
      setUserProfile(user);
      router.replace("/(tabs)/store");
    } catch (err) {
      console.error(err);
      setError(t("registerFailed"));
    }
  };

  const goToLogin = () => {
    router.push("/auth/login")
  }

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    []
  );

  const selectLanguage = (code: "en" | "ar") => {
    setLang(code);
    sheetRef.current?.dismiss();
  };

  const continueAsGuest = async () => {
    await logout();
    router.replace("/(tabs)/store");
  };

  return (
    <BottomSheetModalProvider>
      <View style={[styles.safe]} >
        <View style={styles.container}>
          <View style={{ flex: 1, justifyContent: 'space-between', position: 'relative' }}>
            <Image source={require('../../assets/watermark4.png')} style={styles.watermark} />

            <View style={{}}>
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
                <Text weight="bold" style={styles.title}>{t("register")}</Text>
              </View>

              <View style={styles.card}>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={t("name")}
                  placeholderTextColor={palette.muted}
                />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t("email")}
                  placeholderTextColor={palette.muted}
                  autoCapitalize="none"
                />
                <View style={{ position: 'relative' }}>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder={t("password")}
                    secureTextEntry={!showPassword}
                    placeholderTextColor={palette.muted}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.toggle}>
                    {showPassword ?
                      <AntDesign name="eye-invisible" size={20} color="black" />
                      :
                      <AntDesign name="eye" size={20} color="black" />
                    }
                  </TouchableOpacity>
                </View>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              {/* <View style={[styles.row, { justifyContent: 'center' }]}>
            <Text>{t("alreadyHaveAnAccount")}</Text>
            <Link href="/auth/login" style={styles.link}>
              {t("login")}
            </Link>
          </View> */}
            </View>

            <View style={{ gap: 10 }}>
              <Button title={t("register")} onPress={submit} />

              <View style={[styles.row, { justifyContent: 'center' }]}>
                <View style={{ flexDirection: 'row', gap: 5, alignItems: 'baseline' }}>
                  <Text>{t("alreadyHaveAnAccount")}</Text>
                  <TouchableOpacity onPress={goToLogin} >
                    <Text style={styles.link}>{t("login")}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', marginVertical: 10 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: palette.border }}></View>
                <Text>{t("or")}</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: palette.border }}></View>
              </View>

              <TouchableOpacity style={styles.secondaryCta} onPress={continueAsGuest} disabled={loggingIn}>
                <Text style={styles.secondaryCtaText}>{t("continueAsGuest") ?? "Continue as guest"}</Text>
              </TouchableOpacity>
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
                <View style={{ flexDirection: 'row', gap: 10 }}>
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

const createStyles = (palette: any, isRTL: boolean, insets: any) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: palette.background,
      writingDirection: isRTL ? "rtl" : "ltr",
      direction: isRTL ? "rtl" : "ltr",
      // borderWidth:6
    },
    secondaryCta: {
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
    },
    secondaryCtaText: {
      color: palette.text,
      fontSize: 16,
      fontWeight: "700",
      width: '100%',
      textAlign: "center"
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
    watermark: {
      position: 'absolute',
      top: 0,
      right: -20,
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      // borderWidth: 3,
      opacity: 0.4,
    },
    logo: {
      width: 100,
      height: 100,
      objectFit: 'contain'
    },
    row: { flexDirection: "row", justifyContent: "flex-start", gap: 5 },
    hero: { gap: 6, marginBottom: 18 },
    kicker: { color: palette.accent, textAlign: "left" },
    title: {
      color: palette.text, fontSize: 22,
    },
    card: { gap: 12 },
    cardTitle: {
      color: palette.text, fontSize: 22,
    },
    input: {
      backgroundColor: palette.surface,
      color: palette.text,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
      textAlign: isRTL ? 'right' : 'left'
    },
    toggle: { position: 'absolute', alignSelf: "flex-end", top: 12, right: 10 },
    link: { color: palette.accent },
    error: { color: "#f87171" },
    sheetContainer: {
      paddingHorizontal: 18,
      paddingBottom: insets.bottom + 10,
      gap: 10,
      alignItems: 'center'
    },
    sheetTitle: {
      color: palette.text,
      fontSize: 18,
      marginBottom: 4,
      // borderWidth:1,
      textAlign: 'center'
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
      flex: 1,
      gap: 10
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
