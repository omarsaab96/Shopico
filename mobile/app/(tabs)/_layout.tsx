import { Tabs } from "expo-router";
import { useMemo } from "react";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const { palette } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      tabBarShowLabel: true,
      tabBarStyle: {
        backgroundColor: palette.card,
        borderTopColor: palette.border,
        paddingBottom: Math.max(insets.bottom, 8),
      },
      tabBarActiveTintColor: palette.accent,
      tabBarInactiveTintColor: palette.muted,
    }),
    [palette, insets.bottom, t]
  );
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="store" options={{ title: t("store"), tabBarLabel: t("store") }} />
      <Tabs.Screen name="cart" options={{ title: t("cart"), tabBarLabel: t("cart") }} />
      <Tabs.Screen name="orders" options={{ title: t("orders"), tabBarLabel: t("orders") }} />
      <Tabs.Screen name="profile" options={{ title: t("profile"), tabBarLabel: t("profile") }} />
    </Tabs>
  );
}
