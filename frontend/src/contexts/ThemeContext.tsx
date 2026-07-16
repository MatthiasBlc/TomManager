/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useLayoutEffect, type ReactNode } from "react";

const THEME_KEY = "app_theme";
const DARK_THEME = "ToM";
// Theme clair : "light" stock de DaisyUI (seul theme clair compile, voir styles/index.css)
const LIGHT_THEME = "light";

// base-100 de chaque theme — pour la barre systeme (meta theme-color)
const THEME_COLORS: Record<ThemeMode, string> = {
  dark: "#232323",
  light: "#ffffff",
};

type ThemeMode = "dark" | "light";

function getStoredTheme(): ThemeMode {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);

  useLayoutEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      theme === "dark" ? DARK_THEME : LIGHT_THEME
    );
    // Synchroniser la barre systeme (PWA / mobile) avec le fond du theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", THEME_COLORS[theme]);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // localStorage indisponible
      }
      return next;
    });
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme doit être utilisé dans un ThemeProvider");
  return ctx;
}
