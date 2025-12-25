import { View, Text, StyleSheet } from "react-native";
import { useMemo } from "react";
import { useTheme } from "../lib/theme";

const StatCard = ({ label, value }: { label: string; value: string | number }) => {
  const { palette } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          padding: 14,
          borderRadius: 14,
          backgroundColor: palette.card,
          borderWidth: 1,
          borderColor: palette.border,
        },
        label: { color: palette.muted, fontSize: 12, textTransform: "uppercase" },
        value: { color: palette.text, fontSize: 20, fontWeight: "700", marginTop: 4 },
      }),
    [palette]
  );

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
};

export default StatCard;
