import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Text, TextInput, View, StyleSheet } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import { useAuth } from "../../lib/auth";
import { palette } from "../../styles/theme";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("customer@shopico.local");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");

  const submit = async () => {
    try {
      await login(email, password);
      router.replace("/");
    } catch (err) {
      console.error(err);
      setError("Invalid credentials");
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Shopico</Text>
        <Text style={styles.title}>Grocery on the go.</Text>
        <Text style={styles.subtitle}>Earn points, track orders, and level up your membership.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Login</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#94a3b8" />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          placeholderTextColor="#94a3b8"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Continue" onPress={submit} />
        <View style={styles.row}>
          <Link href="/auth/forgot" style={styles.link}>
            Forgot password
          </Link>
          <Link href="/auth/register" style={styles.link}>
            Create account
          </Link>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 6, marginBottom: 18 },
  kicker: { color: palette.accent, fontWeight: "700" },
  title: { color: palette.text, fontSize: 28, fontWeight: "800" },
  subtitle: { color: palette.muted, fontSize: 14 },
  card: { backgroundColor: palette.card, padding: 16, borderRadius: 14, gap: 12, borderWidth: 1, borderColor: "#1f2937" },
  cardTitle: { color: palette.text, fontSize: 18, fontWeight: "700" },
  input: {
    backgroundColor: "#0b1220",
    color: palette.text,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  error: { color: "#f87171" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  link: { color: palette.accent },
});
