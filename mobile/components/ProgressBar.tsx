import { View, StyleSheet } from "react-native";
import { useMemo } from "react";
import { useTheme } from "../lib/theme";

const ProgressBar = ({ progress }: { progress: number }) => {
  const width = Math.min(100, Math.max(0, progress * 100));
  const { palette } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          height: 10,
          backgroundColor: palette.border,
          borderRadius: 999,
          overflow: "hidden",
        },
        bar: {
          height: "100%",
          backgroundColor: palette.accent,
        },
      }),
    [palette]
  );
  return (
    <View style={styles.container}>
      <View style={[styles.bar, { width: `${width}%` }]} />
    </View>
  );
};

export default ProgressBar;
