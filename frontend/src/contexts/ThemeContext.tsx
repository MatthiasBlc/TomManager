/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useLayoutEffect,
  type ReactNode,
} from "react";

const THEME_KEY = "app_theme";
const DARK_THEME = "ToM";
const LIGHT_THEME = "winter";

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
      theme === "dark" ? DARK_THEME : LIGHT_THEME,
    );
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

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme doit etre utilise dans un ThemeProvider");
  return ctx;
}
