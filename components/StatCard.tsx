import { View, Text, StyleSheet } from "react-native";
import { palette } from "../styles/theme";

const StatCard = ({ label, value }: { label: string; value: string | number }) => (
  <View style={styles.card}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  label: { color: palette.muted, fontSize: 12, textTransform: "uppercase" },
  value: { color: palette.text, fontSize: 20, fontWeight: "700", marginTop: 4 },
});

export default StatCard;
