"use client";

import { useEffect, useState } from "react";

export type ThemeName = "light" | "dark" | "contrast";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark" || saved === "contrast") setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <>
      <nav aria-label="Theme">
        {(["light", "dark", "contrast"] as const).map(value => (
          <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)}>
            {value === "contrast" ? "High contrast" : value[0].toUpperCase() + value.slice(1)}
          </button>
        ))}
      </nav>
      {children}
    </>
  );
}
