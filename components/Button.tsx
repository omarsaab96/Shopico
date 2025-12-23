import { Pressable, Text, StyleSheet } from "react-native";
import { palette } from "../styles/theme";

const Button = ({
  title,
  onPress,
  secondary,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
}) => (
  <Pressable style={secondary ? styles.secondary : styles.primary} onPress={onPress}>
    <Text style={secondary ? styles.secondaryText : styles.primaryText}>{title}</Text>
  </Pressable>
);

const base = {
  paddingVertical: 14,
  borderRadius: 12,
  alignItems: "center" as const,
};

const styles = StyleSheet.create({
  primary: {
    ...base,
    backgroundColor: palette.accent,
  },
  primaryText: { color: "#0f172a", fontWeight: "700", fontSize: 16 },
  secondary: { ...base, borderWidth: 1, borderColor: "#334155" },
  secondaryText: { color: palette.text, fontWeight: "700", fontSize: 16 },
});

export default Button;
