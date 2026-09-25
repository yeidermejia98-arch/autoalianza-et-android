import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { ThemeColors, ThemeMode, lightColors, darkColors } from "../theme";
import { getSavedThemeMode, setSavedThemeMode } from "../lib/storage";

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // "light" | "dark" | null
  // Antes de leer la preferencia guardada, usamos el modo del sistema como
  // valor inicial para que la primera pantalla ya se vea correcta.
  const [mode, setMode] = useState<ThemeMode>(systemScheme === "dark" ? "dark" : "light");
  const [hasLoadedPreference, setHasLoadedPreference] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await getSavedThemeMode();
      if (saved) {
        setMode(saved);
      } else if (systemScheme === "dark" || systemScheme === "light") {
        setMode(systemScheme);
      }
      setHasLoadedPreference(true);
    })();
    // Solo se ejecuta una vez al montar; no queremos que el cambio de tema
    // del sistema después de abrir la app sobrescriba la elección manual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setThemeMode(newMode: ThemeMode) {
    setMode(newMode);
    setSavedThemeMode(newMode);
  }

  function toggleTheme() {
    setThemeMode(mode === "dark" ? "light" : "dark");
  }

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: mode === "dark" ? darkColors : lightColors,
      isDark: mode === "dark",
      toggleTheme,
      setThemeMode,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode]
  );

  // Evita un parpadeo del tema equivocado mientras se lee AsyncStorage.
  if (!hasLoadedPreference) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme debe usarse dentro de un <ThemeProvider>");
  }
  return ctx;
}
