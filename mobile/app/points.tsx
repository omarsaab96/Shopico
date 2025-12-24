import { useEffect, useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import ProgressBar from "../components/ProgressBar";
import Screen from "../components/Screen";
import api from "../lib/api";
import { palette } from "../styles/theme";

export default function PointsScreen() {
  const [data, setData] = useState<any>();

  useEffect(() => {
    api.get("/points").then((res) => setData(res.data.data));
  }, []);

  const points = data?.points || 0;
  const progress = (points % (data?.rewardThreshold || 100)) / (data?.rewardThreshold || 100);
  const remaining = (data?.rewardThreshold || 100) - (points % (data?.rewardThreshold || 100));

  return (
    <Screen>
      <Text style={styles.title}>Points</Text>
      <View style={styles.card}>
        <Text style={styles.value}>{points} pts</Text>
        <ProgressBar progress={progress} />
        <Text style={styles.muted}>{remaining} points left to get a discount</Text>
        {data?.rewardAvailable && <Text style={styles.success}>Reward available: {data?.rewardValue} SYP</Text>}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>How to earn</Text>
        <Text style={styles.muted}>1 point per 10,000 SYP on subtotal after delivery.</Text>
        <Text style={styles.cardTitle}>How to use</Text>
        <Text style={styles.muted}>Apply reward during checkout for one order.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12 },
  card: { backgroundColor: palette.card, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#1f2937", gap: 8, marginBottom: 12 },
  value: { color: palette.text, fontSize: 32, fontWeight: "800" },
  muted: { color: palette.muted },
  success: { color: "#22c55e", fontWeight: "700" },
  cardTitle: { color: palette.text, fontWeight: "700", marginTop: 8 },
});
