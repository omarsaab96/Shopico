import { Tabs } from "expo-router";
import { useMemo } from "react";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, Text } from "react-native";
import { useCart } from "../../lib/cart";

export default function TabsLayout() {
  const { palette } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { items } = useCart();
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
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
      <Tabs.Screen
        name="cart"
        options={{
          title: t("cart"),
          tabBarLabel: t("cart"),
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
          tabBarBadgeStyle: { backgroundColor: palette.accent, color: "#fff" },
        }}
      />
      <Tabs.Screen name="orders" options={{ title: t("orders"), tabBarLabel: t("orders") }} />
      <Tabs.Screen name="profile" options={{ title: t("profile"), tabBarLabel: t("profile") }} />
    </Tabs>
  );
}
