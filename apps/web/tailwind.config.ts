import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,mdx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        ink: {
          50: "#f7f8fb",
          100: "#eceef5",
          200: "#d9dde9",
          300: "#b6bdcd",
          400: "#8b94a8",
          500: "#656f86",
          600: "#4c566c",
          700: "#3a4356",
          800: "#232b3b",
          900: "#121826",
          950: "#080c14",
        },
        brand: {
          50: "#eef4ff",
          100: "#dbe7ff",
          200: "#bcd2ff",
          300: "#8fb4ff",
          400: "#5b8cff",
          500: "#3566f5",
          600: "#1f4ee0",
          700: "#1a3fbb",
          800: "#1b3795",
          900: "#1b3275",
          950: "#142258",
        },
        saffron: {
          50: "#fff8e8",
          100: "#ffefc6",
          200: "#ffdd8a",
          300: "#ffc64d",
          400: "#ffae1f",
          500: "#f79009",
          600: "#d97305",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glass: "var(--shadow-1)",
        "glass-lg": "var(--shadow-2)",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.75rem",
      },
      maxWidth: {
        "8xl": "88rem",
      },
      opacity: {
        7: "0.07",
        12: "0.12",
        15: "0.15",
        35: "0.35",
        45: "0.45",
        55: "0.55",
        65: "0.65",
        85: "0.85",
      },
      gridTemplateRows: {
        7: "repeat(7, minmax(0, 1fr))",
      },
    },
  },
  plugins: [],
};

export default config;
