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
          // height: 10,
          backgroundColor: palette.border,
          borderRadius: 999,
          overflow: "hidden",
          padding:2,
        },
        bar: {
          height: 5,
          backgroundColor: palette.accent,
          borderRadius:999
        },
      }),
    [palette]
  );
  return (
    <View style={styles.container}>
      <View style={[styles.bar, { width: `${width == 0 ? 5 : width}%` }]} />
    </View>
  );
};

export default ProgressBar;
