import { SafeAreaView } from "react-native-safe-area-context";
import { View, StyleSheet } from "react-native";
import { useMemo } from "react";
import { useTheme } from "../lib/theme";

const Screen = ({ children }: { children: React.ReactNode }) => {
  const { palette } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: palette.background,
        },
        container: {
          flex: 1,
          padding: 16,
        },
      }),
    [palette]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>{children}</View>
    </SafeAreaView>
  );
};

export default Screen;
