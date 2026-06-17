"use client";

import { createContext, useContext, useEffect, ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeCtx {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: "light", toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Dark mode desactivado — siempre light
  const theme: Theme = "light";

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("mcm-theme", "light");
  }, []);

  function toggleTheme() {
    // Desactivado por ahora
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
