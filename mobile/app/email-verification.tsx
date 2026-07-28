import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import Button from "../components/Button";
import Screen from "../components/Screen";
import Text from "../components/Text";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";

export default function EmailVerification() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const { user, loading, setUserProfile } = useAuth();
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [hasSentCode, setHasSentCode] = useState(false);

  const returnTo = typeof params.returnTo === "string" ? params.returnTo : "/(tabs)/cart";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    if (user.emailVerified) {
      router.replace(returnTo as any);
    }
  }, [loading, returnTo, router, user]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => {
      setResendIn((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const sendOtp = async () => {
    if (sending || resendIn > 0 || !user || user.emailVerified) return;
    setSending(true);
    setError("");
    setMessage("");
    try {
      await api.post("/auth/me/email/send-otp");
      setHasSentCode(true);
      setResendIn(60);
      setMessage(t("emailVerificationOtpSent") ?? "Verification code sent to your email");
    } catch (err: any) {
      setError(err?.response?.data?.message || t("emailVerificationSendFailed") || "Could not send verification code");
    } finally {
      setSending(false);
    }
  };

  const verifyEmail = async () => {
    if (verifying) return;
    if (otp.length !== 6) {
      setError(t("invalidForm") ?? "Please fill all fields correctly");
      return;
    }
    setVerifying(true);
    setError("");
    setMessage("");
    try {
      const res = await api.post("/auth/me/email/verify", { otp });
      if (res.data.data?.user) setUserProfile(res.data.data.user);
      router.replace(returnTo as any);
    } catch (err: any) {
      setError(err?.response?.data?.message || t("emailVerificationFailed") || "Could not verify email");
    } finally {
      setVerifying(false);
    }
  };

  const pasteOtp = async () => {
    try {
      const Clipboard = require("expo-clipboard");
      const text = await Clipboard.getStringAsync();
      const code = text.replace(/\D/g, "").slice(0, 6);
      if (code) setOtp(code);
    } catch {
      setError(t("clipboardReadFailed") ?? "Could not read clipboard");
    }
  };

  return (
    <Screen showBack backLabel={t("back") ?? "Back"}>
      <View style={styles.wrap}>
        <Text weight="bold" style={styles.title}>
          {t("verifyEmail") ?? "Verify email"}
        </Text>

        {hasSentCode ? (
          <>
            <Text style={styles.description}>
              {t("emailVerificationCopy") ?? "Enter the 6-digit code sent to"}
            </Text>
            <Text weight="bold" style={[styles.description, { marginBottom: 30 }]}>
              {user?.email}
            </Text>
            <View style={styles.field}>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, styles.inputWithPaste]}
                  value={otp}
                  onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  placeholderTextColor={palette.muted}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <TouchableOpacity style={styles.pasteBtn} onPress={pasteOtp} activeOpacity={0.85}>
                  <Feather name="clipboard" size={22} color={palette.muted} />
                </TouchableOpacity>
              </View>
            </View>

            <Button title={verifying ? (t("verifying") ?? "Verifying...") : (t("verify") ?? "Verify")} onPress={verifyEmail} />
          </>
        ) : (
          <>
            <Text style={styles.description}>
              {t("verifyEmailDescription") ?? "A verification code will be sent to the below email address"}
            </Text>
            <Text weight="bold" style={[styles.description, { marginBottom: 30 }]}>
              {user?.email}
            </Text>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={[styles.resendBtn, (resendIn > 0 || verifying) && styles.resendBtnDisabled]} onPress={sendOtp} disabled={sending || verifying || resendIn > 0}>
          {sending ? (
            <ActivityIndicator color={palette.accent} size="small" />
          ) : (
            <Text weight="bold" style={[styles.resendText, resendIn > 0 && styles.resendTextDisabled]}>
              {resendIn > 0
                ? `${t("resendCodeIn") ?? "Resend code in"} ${resendIn}s`
                : hasSentCode
                  ? (t("resendCode") ?? "Resend code")
                  : (t("sendCode") ?? "Send code")}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) => {
  const align = isRTL ? ("right" as const) : ("left" as const);
  return StyleSheet.create({
    wrap: {
      flex: 1,
      gap: 14,
      paddingTop: 20
    },
    title: {
      color: palette.text,
      fontSize: 24,
      textAlign: "center",
    },
    description: {
      color: palette.text,
      fontSize: 16,
      textAlign: "center",
    },
    field: {
      gap: 7,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    input: {
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 14,
      color: palette.text,
      paddingHorizontal: 12,
      paddingVertical: 13,
      fontSize: 22,
      fontWeight: "900",
      letterSpacing: 0,
      textAlign: "center",
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    inputWithPaste: {
      flex: 1,
    },
    pasteBtn: {
      width: 50,
      height: 50,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    resendBtn: {
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    resendBtnDisabled: {
      opacity: 0.65,
    },
    resendText: {
      color: palette.accent,
    },
    resendTextDisabled: {
      color: palette.muted,
    },
    error: {
      color: "#ef4444",
      textAlign: align,
    },
  });
};
