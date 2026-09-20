import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        industrial: {
          950: "#090d16",
          900: "#0e1526",
          850: "#131d33",
          800: "#182440",
          700: "#24355a",
          600: "#364d7d",
          500: "#4e6ba6",
        },
        critical: {
          DEFAULT: "#ef4444",
          dark: "#991b1b",
          light: "#fca5a5",
          bg: "#450a0a",
        },
        warning: {
          DEFAULT: "#f59e0b",
          dark: "#92400e",
          light: "#fde68a",
          bg: "#451a03",
        },
        compliance: {
          DEFAULT: "#64748b",
          dark: "#334155",
          light: "#cbd5e1",
          bg: "#0f172a",
        },
        safe: {
          DEFAULT: "#10b981",
          dark: "#065f46",
          light: "#a7f3d0",
          bg: "#022c22",
        },
      },
      animation: {
        "pulse-fast": "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "siren-glow": "sirenGlow 1.2s ease-in-out infinite",
        "border-alert": "borderFlash 1s ease-in-out infinite",
        "radar-sweep": "radarSweep 4s linear infinite",
      },
      keyframes: {
        sirenGlow: {
          "0%, 100%": { boxShadow: "0 0 15px rgba(239, 68, 68, 0.4), inset 0 0 15px rgba(239, 68, 68, 0.2)" },
          "50%": { boxShadow: "0 0 30px rgba(239, 68, 68, 0.9), inset 0 0 25px rgba(239, 68, 68, 0.5)" },
        },
        borderFlash: {
          "0%, 100%": { borderColor: "rgba(239, 68, 68, 1)" },
          "50%": { borderColor: "rgba(239, 68, 68, 0.2)" },
        },
        radarSweep: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
