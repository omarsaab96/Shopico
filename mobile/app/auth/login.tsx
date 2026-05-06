import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { TextInput, View, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import Screen from "../../components/Screen";
import Text from "../../components/Text";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import AntDesign from "@expo/vector-icons/AntDesign";
import api from "../../lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Login() {
  const { login } = useAuth();
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
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isDark, isRTL), [palette, isRTL]);
  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const normalizeEmail = (value: string) => value.trim().toLowerCase();

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

  return (
    <Screen>
      <View style={{ flex: 1, paddingBottom: insets.bottom + 30, justifyContent: 'space-between', position: 'relative' }}>
        <View style={{ zIndex: 1 }}>
          <View style={{ alignItems: 'center' }}>
            <Image source={require('../../assets/shopico_logo-black.png')} style={styles.logo} />
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

        <View style={{ gap: 10, zIndex: 1 }}>
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
        </View>

        <Image source={require('../../assets/watermark4.png')} style={styles.watermark} />

      </View>
    </Screen>
  );
}

const createStyles = (palette: any, isDark: any, isRTL: boolean) =>
  StyleSheet.create({
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
      // borderWidth:3
      opacity: 0.4,
      pointerEvents: 'none',
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
    backLink: {
      alignSelf: "flex-start",
    },
  });
