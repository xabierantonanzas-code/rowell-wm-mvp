"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type ThemeName = "rowell" | "modern";

interface ThemeColors {
  primary: string;
  primaryDark: string;
  accent: string;
  accentSoft: string;
  bg: string;
  bgCard: string;
  text: string;
  textMuted: string;
  chartColors: string[];
}

interface ThemeContextValue {
  themeName: ThemeName;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ROWELL_COLORS: ThemeColors = {
  primary: "#3D4F63",
  primaryDark: "#293544",
  accent: "#B8965A",
  accentSoft: "#D5B774",
  bg: "#F5F5F5",
  bgCard: "#FFFFFF",
  text: "#1A1A1A",
  textMuted: "#4B5563",
  chartColors: ["#3D4F63", "#B8965A", "#2563eb", "#059669", "#d97706", "#7c3aed", "#dc2626", "#0891b2"],
};

const MODERN_COLORS: ThemeColors = {
  primary: "#0F172A",
  primaryDark: "#020617",
  accent: "#0D9488",
  accentSoft: "#5EEAD4",
  bg: "#F8FAFC",
  bgCard: "#FFFFFF",
  text: "#0F172A",
  textMuted: "#64748B",
  chartColors: ["#0D9488", "#F97316", "#6366F1", "#EC4899", "#14B8A6", "#8B5CF6", "#F59E0B", "#06B6D4"],
};

const STORAGE_KEY = "rowell-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    if (typeof window === "undefined") return "rowell";
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeName | null;
    return stored === "modern" ? "modern" : "rowell";
  });

  // Toggle CSS class + persist. All CSS variables are defined in globals.css
  // under :root (rowell default) and .theme-modern (modern override).
  useEffect(() => {
    document.documentElement.classList.toggle("theme-modern", themeName === "modern");
    localStorage.setItem(STORAGE_KEY, themeName);
  }, [themeName]);

  const toggleTheme = useCallback(() => {
    setThemeName((prev) => (prev === "rowell" ? "modern" : "rowell"));
  }, []);

  const colors = themeName === "modern" ? MODERN_COLORS : ROWELL_COLORS;

  return (
    <ThemeContext.Provider value={{ themeName, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}