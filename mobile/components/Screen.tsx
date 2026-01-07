import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useMemo } from "react";
import { useTheme } from "../lib/theme";
import { useRouter } from "expo-router";
import Entypo from '@expo/vector-icons/Entypo';
import { useI18n } from "../lib/i18n";
import Text from "./Text";

type ScreenProps = { children: React.ReactNode; showBack?: boolean; backLabel?: string };

const Screen = ({ children, showBack = false, backLabel = "Back" }: ScreenProps) => {
  const { palette, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isRTL } = useI18n();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: palette.background,
          paddingTop: insets.top,
          writingDirection: isRTL ? "rtl" : "ltr",
          direction: isRTL ? "rtl" : "ltr",
        },
        container: {
          flex: 1,
          paddingHorizontal: 16,
          // paddingTop: 16,
          writingDirection: isRTL ? "rtl" : "ltr",
          direction: isRTL ? "rtl" : "ltr",
        },
        backRow: { flexDirection:'row', alignItems: "center", gap: 5, marginBottom: 10 },
        backText: { color: palette.text },
      }),
    [palette, insets.top, isRTL]
  );

  return (
    <View style={styles.safe}>
      <View style={styles.container}>
        {showBack && (
          <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
            <Entypo name={isRTL ? "chevron-right" : "chevron-left"} size={24} color={isDark ? "#fff" : "#000"} />
            <Text weight="bold" style={styles.backText}>{backLabel}</Text>
          </TouchableOpacity>
        )}
        {children}
      </View>
    </View>
  );
};

export default Screen;
