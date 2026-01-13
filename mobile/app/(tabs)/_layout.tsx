import { Tabs } from "expo-router";
import { useMemo } from "react";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "react-native";
import { useCart } from "../../lib/cart";
import Feather from "@expo/vector-icons/Feather";
import Text from "../../components/Text";

export default function TabsLayout() {
  const { palette } = useTheme();
  const { t, isRTL, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { items } = useCart();
  // const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const itemCount = items.length;
  const tabIcons: Record<string, keyof typeof Feather.glyphMap> = {
    store: "home",
    cart: "shopping-cart",
    orders: "list",
    profile: "user",
  };
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      tabBarShowLabel: true,
      tabBarStyle: {
        backgroundColor: palette.card,
        borderTopColor: palette.border,
        paddingTop: 6,
        paddingBottom: Math.max(insets.bottom + 6, 14),
        height: 64 + insets.bottom,
        direction: "ltr",
        writingDirection: "ltr",
      },
      tabBarItemStyle: { flexDirection: isRTL ? "row-reverse" : "row", writingDirection: isRTL ? "rtl" : "ltr" },
      tabBarLabelStyle: { writingDirection: isRTL ? "rtl" : "ltr", textAlign: isRTL ? "right" : "left" },
      tabBarActiveTintColor: palette.accent,
      tabBarInactiveTintColor: palette.muted,
    }),
    [palette, insets.bottom, t, isRTL]
  );
  const screens = [
    { name: "store", label: t("store"), icon: tabIcons.store },
    { name: "cart", label: t("cart"), icon: tabIcons.cart, badge: itemCount > 0 ? itemCount : undefined },
    { name: "orders", label: t("orders"), icon: tabIcons.orders },
    { name: "profile", label: t("profile"), icon: tabIcons.profile },
  ];
  const orderedScreens = isRTL ? [...screens].reverse() : screens;
  return (
    <Tabs key={lang} screenOptions={screenOptions}>
      {orderedScreens.map((scr) => (
        <Tabs.Screen
          key={scr.name}
          name={scr.name}
          options={{
            title: scr.label,
            tabBarLabel: scr.label,
            tabBarBadge: scr.badge,
            tabBarBadgeStyle: scr.badge ? { backgroundColor: palette.accent, color: "#fff" } : undefined,
            tabBarIcon: ({ color, size }) => <Feather name={scr.icon} color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
