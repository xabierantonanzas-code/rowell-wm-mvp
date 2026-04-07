import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

// MVP6 paleta (Edgard): primary slate-blue + gold calido sobre off-white.
// - primary  #3D4F63  reemplaza al navy intenso anterior
// - gold     #B8965A  acento mas terroso
// - bg       #F5F5F5  fondo neutro
// - text     #1A1A1A  texto principal
// Mantenemos los alias rowell.* legacy apuntando a los mismos hex para no
// romper componentes existentes que usen rowell-navy/rowell-gold/etc.

const PRIMARY = "#3D4F63";
const GOLD = "#B8965A";
const BG = "#F5F5F5";
const TEXT = "#1A1A1A";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: PRIMARY,
          50: "#F4F6F8",
          100: "#E5EAEF",
          200: "#C8D2DC",
          300: "#9FAEC0",
          400: "#6E8298",
          500: PRIMARY,
          600: "#334254",
          700: "#293544",
          800: "#1E2733",
          900: "#131922",
        },
        gold: {
          DEFAULT: GOLD,
          50: "#FAF6EE",
          100: "#F2EAD3",
          200: "#E5D2A4",
          300: "#D5B774",
          400: "#C5A363",
          500: GOLD,
          600: "#967847",
          700: "#705A35",
          800: "#4A3C24",
          900: "#251E12",
        },
        bg: {
          DEFAULT: BG,
          card: "#FFFFFF",
          muted: "#EEEEEE",
        },
        ink: {
          DEFAULT: TEXT,
          muted: "#4B5563",
          subtle: "#9CA3AF",
        },
        // Alias legacy rowell.* (apuntan a la nueva paleta)
        rowell: {
          navy: PRIMARY,
          gold: GOLD,
          light: BG,
          dark: "#1E2733",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
        display: ["var(--font-playfair)", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
