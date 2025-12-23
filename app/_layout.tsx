import { Redirect, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "../lib/auth";
import { CartProvider } from "../lib/cart";
import { palette } from "../styles/theme";

const ProtectedStack = () => {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const inAuthGroup = segments[0] === "auth";
  if (loading) {
    return <StatusBar style="light" />;
  }
  if (!user && !inAuthGroup) {
    return <Redirect href="/auth/login" />;
  }
  if (user && inAuthGroup) {
    return <Redirect href="/" />;
  }
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        contentStyle: { backgroundColor: palette.background },
      }}
    />
  );
};

export default function Layout() {
  return (
    <AuthProvider>
      <CartProvider>
        <ProtectedStack />
        <StatusBar style="light" />
      </CartProvider>
    </AuthProvider>
  );
}
