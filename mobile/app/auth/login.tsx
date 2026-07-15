import { Link, useRouter } from "expo-router";
import { useMemo, useState, useRef, useCallback } from "react";
import { TextInput, View, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import Text from "../../components/Text";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import AntDesign from "@expo/vector-icons/AntDesign";
import api from "../../lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider, BottomSheetView } from "@gorhom/bottom-sheet";

export default function Login() {
  const { login, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loggingIn, setLoggingIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"email" | "password" | "setPassword">("email");
  const { palette, isDark } = useTheme();
  const { lang, setLang, t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isDark, isRTL, insets), [palette, isDark, isRTL, insets]);
  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const normalizeEmail = (value: string) => value.trim().toLowerCase();
  const sheetRef = useRef<BottomSheetModal>(null);

  const languages = [
    { code: "en", label: "English" },
    { code: "ar", label: "العربية" },
  ] as const;

  const checkEmail = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setError(t("invalidForm"));
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setError(t("invalidEmail") ?? "Enter a valid email");
      return;
    }
    setLoggingIn(true);
    setError("");
    try {
      const res = await api.post("/auth/password-status", { email: normalizedEmail });
      const { exists, hasPassword } = res.data.data || {};
      if (!exists) {
        setError(t("accountNotFound") ?? "Account not found");
        return;
      }
      setStep(hasPassword ? "password" : "setPassword");
    } catch (err: any) {
      if (!err?.response) {
        setError(t("networkError") ?? "Unable to reach the server");
        return;
      }
      const message = err.response?.data?.message;
      setError(message || t("invalidForm"));
    } finally {
      setLoggingIn(false);
    }
  };

  const goToRegister = () => {
    router.push("/auth/register")
  }

  const continueAsGuest = async () => {
    await logout();
    router.replace("/(tabs)/store");
  };

  const submit = async () => {
    setLoggingIn(true);
    try {
      await login(normalizeEmail(email), password);
      router.replace("/(tabs)/store");
    } catch (err: any) {
      console.error(err);
      if (!err?.response) {
        setError(t("networkError") ?? "Unable to reach the server");
      } else {
        setError(t("invalidCredentials"));
      }
    } finally {
      setLoggingIn(false);
    }
  };

  const setInitialPassword = async () => {
    if (!password.trim() || !confirmPassword.trim()) {
      setError(t("invalidForm"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("passwordsMismatch") ?? "Passwords do not match");
      return;
    }
    setLoggingIn(true);
    setError("");
    try {
      const normalizedEmail = normalizeEmail(email);
      await api.post("/auth/set-password", { email: normalizedEmail, password });
      await login(normalizedEmail, password);
      router.replace("/(tabs)/store");
    } catch (err: any) {
      console.error(err);
      if (!err?.response) {
        setError(t("networkError") ?? "Unable to reach the server");
      } else {
        setError(t("invalidForm"));
      }
    } finally {
      setLoggingIn(false);
    }
  };

  const goToForgotPass = () => {
    router.push("/auth/forgot");
  }

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
                <Text weight="bold" style={styles.title}>{t("login")}</Text>
              </View>

              <View style={styles.card}>
                {step === "email" ? (
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder={t("email")}
                    placeholderTextColor={palette.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                ) : (
                  <View style={styles.row}>
                    <Text>{email}</Text>
                    <TouchableOpacity
                      style={styles.backLink}
                      onPress={() => {
                        setStep("email");
                        setPassword("");
                        setConfirmPassword("");
                        setError("");
                      }}
                    >
                      <Text style={styles.link}>{t("changeEmail") ?? "Change email"}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {(step === "password" || step === "setPassword") && (
                  <>
                    <View style={{ position: "relative" }}>
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
                  </>
                )}

                {step === "setPassword" && (
                  <View style={{ position: "relative" }}>
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder={t("confirmPassword") ?? "Confirm password"}
                      secureTextEntry={!showPassword}
                      placeholderTextColor={palette.muted}
                    />
                  </View>
                )}

                {error ? <Text style={styles.error}>{error}</Text> : null}

                {step === "password" &&
                  <TouchableOpacity onPress={goToForgotPass}>
                    <Text style={styles.link}>{t("forgotPassword")}</Text>
                  </TouchableOpacity>
                }
              </View>
            </View>

            <View style={{ gap: 10 }}>
              {step === "email" && (
                <TouchableOpacity style={styles.cta} onPress={checkEmail}>
                  <Text style={styles.ctaText}>
                    {loggingIn ? t("loggingIn") : (t("continue") ?? "Continue")}
                  </Text>
                  {loggingIn && <ActivityIndicator size={"small"} color={"#fff"} />}
                </TouchableOpacity>
              )}
              {step === "password" && (
                <TouchableOpacity style={styles.cta} onPress={submit}>
                  <Text style={styles.ctaText}>
                    {loggingIn ? t("loggingIn") : t("login")}
                  </Text>
                  {loggingIn && <ActivityIndicator size={"small"} color={"#fff"} />}
                </TouchableOpacity>
              )}

              {step === "setPassword" && (
                <TouchableOpacity style={styles.cta} onPress={setInitialPassword}>
                  <Text style={styles.ctaText}>
                    {loggingIn ? t("loggingIn") : (t("setPassword") ?? "Set password")}
                  </Text>
                  {loggingIn && <ActivityIndicator size={"small"} color={"#fff"} />}
                </TouchableOpacity>
              )}

              <View style={[styles.row, { justifyContent: 'center' }]}>
                <View style={{ flexDirection: 'row', gap: 5, alignItems: 'baseline' }}>
                  <Text>{t("donthaveAnAccount")}</Text>
                  <TouchableOpacity onPress={goToRegister} >
                    <Text style={styles.link}>{t("register")}</Text>
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
    subtitle: {
      color: palette.muted,
      fontSize: 14,
      textAlign: "left"
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
    card: {
      gap: 12,
    },
    cardTitle: { color: palette.text, fontSize: 18 },
    input: {
      backgroundColor: palette.surface,
      color: palette.text,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
      textAlign: isRTL ? "right" : "left"
    },
    toggle: { position: "absolute", alignSelf: "flex-end", top: 12, right: 10 },
    error: { color: "#f87171" },
    row: { flexDirection: "row", justifyContent: "space-between" },
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
    backLink: {
      alignSelf: "flex-start",
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
  });
