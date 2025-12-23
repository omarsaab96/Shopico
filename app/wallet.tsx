import { useEffect, useState } from "react";
import { Text, TextInput, View, StyleSheet, FlatList } from "react-native";
import Button from "../components/Button";
import Screen from "../components/Screen";
import api from "../lib/api";
import { palette } from "../styles/theme";

export default function WalletScreen() {
  const [wallet, setWallet] = useState<any>();
  const [amount, setAmount] = useState("50000");
  const [method, setMethod] = useState("CASH_STORE");

  const load = () => api.get("/wallet").then((res) => setWallet(res.data.data));
  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    await api.post("/wallet/topups", { amount: Number(amount), method });
    load();
  };

  return (
    <Screen>
      <Text style={styles.title}>Wallet</Text>
      <View style={styles.card}>
        <Text style={styles.balance}>{wallet?.wallet?.balance?.toLocaleString() || 0} SYP</Text>
        <Text style={styles.muted}>Balance</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top-up request</Text>
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" />
        <View style={styles.row}>
          {["CASH_STORE", "SHAM_CASH", "BANK_TRANSFER"].map((m) => (
            <Text key={m} style={[styles.pill, method === m && styles.pillActive]} onPress={() => setMethod(m)}>
              {m}
            </Text>
          ))}
        </View>
        <Button title="Submit request" onPress={submit} />
      </View>
      <FlatList
        data={wallet?.transactions || []}
        keyExtractor={(_, idx) => String(idx)}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        renderItem={({ item }: any) => (
          <View style={styles.rowCard}>
            <Text style={styles.value}>{item.type} {item.amount}</Text>
            <Text style={styles.muted}>{item.source}</Text>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12 },
  card: { backgroundColor: palette.card, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#1f2937", marginBottom: 12, gap: 8 },
  balance: { color: palette.accent, fontSize: 24, fontWeight: "800" },
  muted: { color: palette.muted },
  cardTitle: { color: palette.text, fontSize: 18, fontWeight: "700" },
  input: {
    backgroundColor: "#0b1220",
    color: palette.text,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  row: { flexDirection: "row", gap: 8 },
  pill: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, color: palette.text, borderWidth: 1, borderColor: "#1f2937" },
  pillActive: { backgroundColor: palette.accent, color: "#0f172a", borderColor: palette.accent },
  rowCard: { backgroundColor: palette.card, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#1f2937" },
  value: { color: palette.text, fontWeight: "700" },
});
