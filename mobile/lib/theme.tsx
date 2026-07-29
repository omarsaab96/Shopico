import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ColorSchemeName, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeMode = "light" | "dark" | "system";

type Palette = {
  background: string;
  card: string;
  accent: string;
  accentSoft: string;
  text: string;
  muted: string;
  surface: string;
  border: string;
};

const lightPalette: Palette = {
  background: "#f7f9fc",
  card: "#ffffff",
  surface: "#eef1f7",
  accent: "#ff7a1f",
  accentSoft: "#ffb347",
  text: "#0f172a",
  muted: "#4b5563",
  border: "#d3dae6",
};

const darkPalette: Palette = {
  background: "#111",
  card: "#333",
  surface: "#444",
  accent: "#ff7a1f",
  accentSoft: "#ffb347",
  text: "#ccc",
  muted: "#555",
  border: "#222",
};

interface ThemeContextValue {
  mode: ThemeMode;
  palette: Palette;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

const THEME_STORAGE_KEY = "theme-mode";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const resolvePalette = (mode: ThemeMode, system: ColorSchemeName) => {
  // MVP: dark mode is temporarily disabled. Keep the original mode/system
  // plumbing in place so it can be restored without touching screens.
  // const effective = mode === "system" ? system || "light" : mode;
  // const isDark = effective === "dark";
  // return { palette: isDark ? darkPalette : lightPalette, isDark };
  void mode;
  void system;
  return { palette: lightPalette, isDark: false };
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const systemScheme = useColorScheme();

  useEffect(() => {
    // MVP: ignore any previously stored dark/system preference for now.
    // AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
    //   if (stored === "light" || stored === "dark" || stored === "system") {
    //     setModeState(stored);
    //   }
    // });
  }, []);

  const setMode = (next: ThemeMode) => {
    // MVP: force light mode until dark mode is ready to ship.
    // setModeState(next);
    // AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
    void next;
    setModeState("light");
    AsyncStorage.setItem(THEME_STORAGE_KEY, "light").catch(() => {});
  };

  const { palette, isDark } = useMemo(
    () => resolvePalette(mode, systemScheme),
    [mode, systemScheme]
  );

  const value = useMemo(
    () => ({
      mode,
      palette,
      isDark,
      setMode,
    }),
    [mode, palette, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
