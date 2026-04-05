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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Initial sync from localStorage
    const saved = localStorage.getItem("signalstack_theme") as Theme;
    if (saved && ["onyx", "light", "cyberpunk"].includes(saved)) {
      setCurrentTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      document.documentElement.setAttribute("data-theme", "onyx");
    }
    setMounted(true);
  }, []);

  const setTheme = (theme: Theme) => {
    setCurrentTheme(theme);
    localStorage.setItem("signalstack_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

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
