import { Link } from "expo-router";
import { useState } from "react";
import { Text, TextInput, View, StyleSheet } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import { palette } from "../../styles/theme";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const submit = () => {
    setSent(true);
  };

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Reset password</Text>
        <Text style={styles.muted}>We will send a recovery link to your email.</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#94a3b8" />
        {sent && <Text style={styles.success}>If this email exists, a link was sent.</Text>}
        <Button title="Send link" onPress={submit} />
        <Link href="/auth/login" style={styles.link}>
          Back to login
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.card, padding: 16, borderRadius: 14, gap: 12, borderWidth: 1, borderColor: "#1f2937" },
  cardTitle: { color: palette.text, fontSize: 18, fontWeight: "700" },
  muted: { color: palette.muted },
  input: {
    backgroundColor: "#0b1220",
    color: palette.text,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  link: { color: palette.accent },
  success: { color: "#22c55e" },
});
