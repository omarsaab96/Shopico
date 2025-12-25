import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { Text, TextInput, View, StyleSheet } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  const submit = () => {
    setSent(true);
  };

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("forgotPassword")}</Text>
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
        <Button title={t("sendLink")} onPress={submit} />
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
    success: { color: "#22c55e" },
  });
