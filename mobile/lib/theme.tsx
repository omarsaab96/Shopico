import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, ColorSchemeName } from "react-native";
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
  const effective = mode === "system" ? system || "light" : mode;
  const isDark = effective === "dark";
  return { palette: isDark ? darkPalette : lightPalette, isDark };
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const colorScheme = Appearance.getColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setModeState(stored);
      }
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
  };

  const { palette, isDark } = useMemo(() => resolvePalette(mode, colorScheme), [mode, colorScheme]);

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
