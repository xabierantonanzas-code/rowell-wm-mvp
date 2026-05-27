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
  // Estilo "rowell" eliminado. La app usa siempre "modern" como tema fijo —
  // el selector de visualizacion del sidebar se quito por decision de producto.
  // Mantengo el ThemeContext para no romper consumidores (useTheme()), pero el
  // tema esta fijado y toggleTheme es no-op.
  const themeName: ThemeName = "modern";

  useEffect(() => {
    // Forzar la clase modern siempre y limpiar cualquier valor antiguo del
    // localStorage para que no haya estado fantasma.
    document.documentElement.classList.add("theme-modern");
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    // no-op: el toggle se desactivo al eliminar el estilo rowell
  }, []);

  const colors = MODERN_COLORS;

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