import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useMemo } from "react";
import { useTheme } from "../lib/theme";
import { useRouter } from "expo-router";

type ScreenProps = { children: React.ReactNode; showBack?: boolean; backLabel?: string };

const Screen = ({ children, showBack = false, backLabel = "Back" }: ScreenProps) => {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: palette.background,
          paddingTop: insets.top,
        },
        container: {
          flex: 1,
          paddingHorizontal: 16,
          paddingTop:16
        },
        backRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 6 },
        backText: { color: palette.text, fontWeight: "700" },
      }),
    [palette, insets.top]
  );

  return (
    <View style={styles.safe}>
      <View style={styles.container}>
        {showBack && (
          <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
            <Text style={styles.backText}>‹</Text>
            <Text style={styles.backText}>{backLabel}</Text>
          </TouchableOpacity>
        )}
        {children}
      </View>
    </View>
  );
};

export default Screen;
