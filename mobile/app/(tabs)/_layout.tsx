import { Redirect, Tabs } from "expo-router";
import { useMemo } from "react";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../../lib/cart";
import Feather from "@expo/vector-icons/Feather";
import { useAuth } from "../../lib/auth";

type TabScreen = {
  name: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  badge?: number;
};

export default function TabsLayout() {
  const { palette } = useTheme();
  const { t, isRTL, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { items } = useCart();
  const { user, loading } = useAuth();
  const canDeliver = user?.role === "driver";
  // const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const itemCount = items.length;

  const tabIcons: Record<string, keyof typeof Feather.glyphMap> = {
    store: "home",
    cart: "shopping-cart",
    orders: "list",
    profile: "user",
    driver: "truck",
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
        direction: "ltr" as const,
        writingDirection: "ltr" as const,
      },
      tabBarItemStyle: {
        flexDirection: isRTL ? "row-reverse" as const : "row" as const,
        writingDirection: isRTL ? "rtl" as const : "ltr" as const,
      },
      tabBarLabelStyle: {
        writingDirection: isRTL ? "rtl" as const : "ltr" as const,
        textAlign: isRTL ? "right" as const : "left" as const,
      },
      tabBarActiveTintColor: palette.accent,
      tabBarInactiveTintColor: palette.muted,
    }),
    [palette, insets.bottom, t, isRTL]
  );

  if (loading) return null;

  if (!user) return <Redirect href="/auth/login" />;

  const customerScreens: TabScreen[] = [
    { name: "store", label: t("store"), icon: tabIcons.store },
    { name: "cart", label: t("cart"), icon: tabIcons.cart, badge: itemCount > 0 ? itemCount : undefined },
    { name: "orders", label: t("orders"), icon: tabIcons.orders },
    { name: "profile", label: t("profile"), icon: tabIcons.profile },
  ];

  const driverScreens: TabScreen[] = [
    { name: "store", label: t("home") ?? "Home", icon: tabIcons.store },
    { name: "driver", label: t("orders"), icon: tabIcons.driver },
    { name: "profile", label: t("profile"), icon: tabIcons.profile },
  ];

  const screens = canDeliver ? driverScreens : customerScreens;
  const hiddenScreens = canDeliver ? ["cart", "orders"] : ["driver"];

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
      {hiddenScreens.map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            href: null,
          }}
        />
      ))}
    </Tabs>
  );
}
