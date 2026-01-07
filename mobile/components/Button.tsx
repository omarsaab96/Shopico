import { Pressable, StyleSheet } from "react-native";
import { useMemo } from "react";
import { useTheme } from "../lib/theme";
import Text from "./Text";

const Button = ({
  title,
  onPress,
  secondary,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
}) => {
  const { palette, isDark } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        primary: {
          paddingVertical: 14,
          borderRadius: 14,
          alignItems: "center",
          backgroundColor: palette.accent,
          shadowColor: palette.accent,
          shadowOpacity: isDark ? 0.3 : 0.15,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        },
        primaryText: { color: "#fff", fontSize: 16 },
        secondary: {
          paddingVertical: 14,
          borderRadius: 14,
          alignItems: "center",
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.surface,
        },
        secondaryText: { color: palette.text, fontSize: 16 },
      }),
    [palette, isDark]
  );

  return (
    <Pressable style={secondary ? styles.secondary : styles.primary} onPress={onPress}>
      <Text weight="bold" style={secondary ? styles.secondaryText : styles.primaryText}>
        {title}
      </Text>
    </Pressable>
  );
};

export default Button;
