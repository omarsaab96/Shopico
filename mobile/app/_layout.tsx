import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "../lib/auth";
import { CartProvider } from "../lib/cart";
import { ThemeProvider, useTheme } from "../lib/theme";
import { I18nProvider } from "../lib/i18n";

const ThemedStack = () => {
  const { palette, isDark } = useTheme();
  return (
    <>
      <Stack
        initialRouteName="(tabs)"
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.text,
          contentStyle: { backgroundColor: palette.background },
          statusBarHidden: false,
          statusBarTranslucent: false,
          navigationBarHidden: false,
          navigationBarTranslucent: true,
          navigationBarColor: palette.background,
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
            <AuthProvider>
              <CartProvider>
                <ThemedStack />
              </CartProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
