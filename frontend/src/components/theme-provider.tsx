"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "onyx" | "light" | "cyberpunk";

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>("onyx");

  useEffect(() => {
    const saved = localStorage.getItem("signalstack_theme") as Theme;
    if (saved && ["onyx", "light", "cyberpunk"].includes(saved)) {
      setCurrentTheme(saved);
    }
  }, []);

  const setTheme = (theme: Theme) => {
    const root = document.documentElement;
    root.classList.add("theme-transition");
    setCurrentTheme(theme);
    localStorage.setItem("signalstack_theme", theme);
    root.setAttribute("data-theme", theme);
    setTimeout(() => root.classList.remove("theme-transition"), 550);
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};
