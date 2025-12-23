import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Text, TextInput, View, StyleSheet } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import api from "../../lib/api";
import { storeTokens } from "../../lib/api";
import { palette } from "../../styles/theme";

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    try {
      const res = await api.post("/auth/register", { name, email, password });
      const { accessToken, refreshToken } = res.data.data;
      await storeTokens(accessToken, refreshToken);
      router.replace("/");
    } catch (err) {
      console.error(err);
      setError("Could not register");
    }
  };

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create account</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor="#94a3b8" />
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
        <Button title="Register" onPress={submit} />
        <Link href="/auth/login" style={styles.link}>
          Already have an account? Login
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  link: { color: palette.accent },
  error: { color: "#f87171" },
});
