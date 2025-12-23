import { View, StyleSheet } from "react-native";
import { palette } from "../styles/theme";

const ProgressBar = ({ progress }: { progress: number }) => {
  const width = Math.min(100, Math.max(0, progress * 100));
  return (
    <View style={styles.container}>
      <View style={[styles.bar, { width: `${width}%` }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 10,
    backgroundColor: "#1f2937",
    borderRadius: 999,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    backgroundColor: palette.accent,
  },
});

export default ProgressBar;
