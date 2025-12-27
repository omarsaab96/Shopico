import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Text, TextInput, View, StyleSheet } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("customer@shopico.local");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  const submit = async () => {
    try {
      await login(email, password);
      router.replace("/(tabs)/store");
    } catch (err) {
      console.error(err);
      setError(t("invalidCredentials"));
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Shopico</Text>
        <Text style={styles.title}>{t("loginHeadline")}</Text>
        <Text style={styles.subtitle}>{t("loginSubhead")}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("login")}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder={t("email")}
          placeholderTextColor={palette.muted}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={t("password")}
          secureTextEntry
          placeholderTextColor={palette.muted}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title={t("continue")} onPress={submit} />
        <View style={styles.row}>
          <Link href="/auth/forgot" style={styles.link}>
            {t("forgotPassword")}
          </Link>
          <Link href="/auth/register" style={styles.link}>
            {t("register")}
          </Link>
        </View>
      </View>
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    hero: { gap: 6, marginBottom: 18 },
    kicker: { color: palette.accent, fontWeight: "700", textAlign: isRTL ? "right" : "left" },
    title: { color: palette.text, fontSize: 28, fontWeight: "800", textAlign: isRTL ? "right" : "left" },
    subtitle: { color: palette.muted, fontSize: 14, textAlign: isRTL ? "right" : "left" },
    card: { backgroundColor: palette.card, padding: 16, borderRadius: 14, gap: 12, borderWidth: 1, borderColor: palette.border },
    cardTitle: { color: palette.text, fontSize: 18, fontWeight: "700" },
    input: {
      backgroundColor: palette.surface,
      color: palette.text,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    error: { color: "#f87171" },
    row: { flexDirection: "row", justifyContent: "space-between" },
    link: { color: palette.accent },
  });
