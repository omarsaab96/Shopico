import { Link } from "expo-router";
import { Text, View, StyleSheet } from "react-native";
import Button from "../components/Button";
import Screen from "../components/Screen";
import { useAuth } from "../lib/auth";
import { palette } from "../styles/theme";

export default function Profile() {
  const { user, logout } = useAuth();
  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>{user?.name}</Text>
        <Text style={styles.muted}>{user?.email}</Text>
        <Text style={styles.muted}>Role: {user?.role}</Text>
        <Button title="Logout" onPress={logout} />
      </View>
      <Link href="/settings" style={styles.link}>
        Settings
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.card, padding: 16, borderRadius: 14, gap: 8, borderWidth: 1, borderColor: "#1f2937" },
  title: { color: palette.text, fontSize: 22, fontWeight: "800" },
  muted: { color: palette.muted },
  link: { color: palette.accent, marginTop: 12 },
});
