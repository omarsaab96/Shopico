import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { TextInput, View, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import Screen from "../../components/Screen";
import Text from "../../components/Text";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import AntDesign from "@expo/vector-icons/AntDesign";
import api from "../../lib/api";

export default function Login() {
  const { login } = useAuth();
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

  const checkEmail = async () => {
    if (!email.trim()) {
      setError(t("invalidForm"));
      return;
    }
    setLoggingIn(true);
    setError("");
    try {
      const res = await api.post("/auth/password-status", { email: email.trim() });
      const { exists, hasPassword } = res.data.data || {};
      if (!exists) {
        setError(t("accountNotFound") ?? "Account not found");
        return;
      }
      setStep(hasPassword ? "password" : "setPassword");
    } catch {
      setError(t("invalidForm"));
    } finally {
      setLoggingIn(false);
    }
  };

  const submit = async () => {
    setLoggingIn(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/store");
    } catch (err) {
      console.error(err);
      setError(t("invalidCredentials"));
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
      await api.post("/auth/set-password", { email: email.trim(), password });
      await login(email.trim(), password);
      router.replace("/(tabs)/store");
    } catch (err) {
      console.error(err);
      setError(t("invalidForm"));
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <Screen>
      <View style={{ flex: 1, paddingTop: 50 }}>
        <View>
          <View style={styles.hero}>
            <Text weight="bold" style={styles.title}>{t("login")}</Text>
          </View>
          <View style={styles.card}>
            {step === "email" && (
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder={t("email")}
                placeholderTextColor={palette.muted}
                autoCapitalize="none"
              />
            )}

            {(step === "password" || step === "setPassword") && (
              <>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t("email")}
                  placeholderTextColor={palette.muted}
                  autoCapitalize="none"
                />
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

            {step !== "email" && (
              <TouchableOpacity
                style={styles.backLink}
                onPress={() => {
                  setStep("email");
                  setPassword("");
                  setConfirmPassword("");
                  setError("");
                }}
              >
                <Text style={styles.link}>{t("back") ?? "Back"}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.row}>
              <Link href="/auth/forgot" style={styles.link}>
                {t("forgotPassword")}
              </Link>
              <Link href="/auth/register" style={styles.link}>
                {t("register")}
              </Link>
            </View>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const createStyles = (palette: any, isDark: any, isRTL: boolean) =>
  StyleSheet.create({
    hero: { gap: 6, marginBottom: 18 },
    kicker: { color: palette.accent, textAlign: "left" },
    title: {
      color: palette.text, fontSize: 28,
      textAlign: "left"
    },
    subtitle: {
      color: palette.muted,
      fontSize: 14,
      textAlign: "left"
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
    toggle: { position: "absolute", alignSelf: "flex-end", top: 12, right: isRTL ? undefined : 10, left: isRTL ? 10 : undefined },
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
