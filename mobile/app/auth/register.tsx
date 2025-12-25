import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Text, TextInput, View, StyleSheet } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import api, { storeTokens } from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  const submit = async () => {
    try {
      const res = await api.post("/auth/register", { name, email, password });
      const { accessToken, refreshToken } = res.data.data;
      await storeTokens(accessToken, refreshToken);
      router.replace("/");
    } catch (err) {
      console.error(err);
      setError(t("registerFailed"));
    }
  };

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("register")}</Text>
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
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={t("password")}
          secureTextEntry
          placeholderTextColor={palette.muted}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title={t("register")} onPress={submit} />
        <Link href="/auth/login" style={styles.link}>
          {t("backToLogin")}
        </Link>
      </View>
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    card: { backgroundColor: palette.card, padding: 16, borderRadius: 14, gap: 12, borderWidth: 1, borderColor: palette.border },
    cardTitle: { color: palette.text, fontSize: 18, fontWeight: "700", textAlign: isRTL ? "right" : "left" },
    input: {
      backgroundColor: palette.surface,
      color: palette.text,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    link: { color: palette.accent },
    error: { color: "#f87171" },
  });
