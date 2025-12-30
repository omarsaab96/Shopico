import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Text, TextInput } from "react-native";
import { useFonts } from "expo-font";
import {
  Manrope_200ExtraLight,
  Manrope_300Light,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import {
  NotoSansArabic_100Thin,
  NotoSansArabic_200ExtraLight,
  NotoSansArabic_300Light,
  NotoSansArabic_400Regular,
  NotoSansArabic_500Medium,
  NotoSansArabic_600SemiBold,
  NotoSansArabic_700Bold,
  NotoSansArabic_800ExtraBold,
  NotoSansArabic_900Black,
} from "@expo-google-fonts/noto-sans-arabic";
import { AuthProvider } from "../lib/auth";
import { CartProvider } from "../lib/cart";
import { ThemeProvider, useTheme } from "../lib/theme";
import { I18nProvider, useI18n } from "../lib/i18n";

const FontGate = ({ children }: { children: React.ReactNode }) => {
  const { isRTL } = useI18n();
  const [fontsLoaded] = useFonts({
    Manrope_200ExtraLight,
    Manrope_300Light,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    NotoSansArabic_100Thin,
    NotoSansArabic_200ExtraLight,
    NotoSansArabic_300Light,
    NotoSansArabic_400Regular,
    NotoSansArabic_500Medium,
    NotoSansArabic_600SemiBold,
    NotoSansArabic_700Bold,
    NotoSansArabic_800ExtraBold,
    NotoSansArabic_900Black,
  });

  useEffect(() => {
    if (!fontsLoaded) return;
    const baseStyle = {
      fontFamily: isRTL ? "NotoSansArabic_400Regular" : "Manrope_400Regular",
      writingDirection: isRTL ? "rtl" : "ltr",
      textAlign: isRTL ? "right" : "left",
    };
    Text.defaultProps = Text.defaultProps || {};
    Text.defaultProps.style = [Text.defaultProps.style, baseStyle].filter(Boolean);
    TextInput.defaultProps = TextInput.defaultProps || {};
    TextInput.defaultProps.style = [TextInput.defaultProps.style, baseStyle].filter(Boolean);
  }, [fontsLoaded, isRTL]);

  if (!fontsLoaded) return null;
  return <>{children}</>;
};

const ThemedStack = ({ lang }: { lang: string }) => {
  const { palette, isDark } = useTheme();
  return (
    <>
      <Stack
        key={lang}
        initialRouteName="(tabs)"
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.text,
          contentStyle: { backgroundColor: palette.background },
          navigationBarHidden: false,
          gestureEnabled: true,
        }}
      />
      <StatusBar style={isDark ? "light" : "dark"} />
    </>
  );
};

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <I18nInner />
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const I18nInner = () => {
  const { lang } = useI18n();
  return (
    <FontGate>
      <AuthProvider>
        <CartProvider>
          <ThemedStack lang={lang} />
        </CartProvider>
      </AuthProvider>
    </FontGate>
  );
};
