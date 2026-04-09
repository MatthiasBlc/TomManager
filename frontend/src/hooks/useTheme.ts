import { useState, useLayoutEffect } from "react";

const THEME_KEY = "app_theme";
const DARK_THEME = "ToM";
const LIGHT_THEME = "winter";

function getStoredTheme(): "dark" | "light" {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(mode: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", mode === "dark" ? DARK_THEME : LIGHT_THEME);
}

export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(getStoredTheme);

  useLayoutEffect(() => {
    applyTheme(theme);
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

  return { theme, toggleTheme };
}
