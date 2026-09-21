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
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["JetBrains Mono", "Courier New", "monospace"],
      },
      fontSize: {
        "3xs": ["0.6rem", { lineHeight: "0.85rem" }],
        "2xs": ["0.68rem", { lineHeight: "0.95rem" }],
      },
      colors: {
        industrial: {
          950: "#060b16",
          900: "#0b1221",
          850: "#0f1929",
          800: "#152030",
          750: "#1b2a40",
          700: "#213252",
          600: "#2e4470",
          500: "#3d5a90",
        },
        nav: {
          bg: "#0a1222",
          border: "#1a2540",
          active: "#1d3461",
          hover: "#141f35",
        },
        critical: {
          DEFAULT: "#ef4444",
          dark: "#7f1d1d",
          light: "#fca5a5",
          bg: "#2d0808",
          border: "#b91c1c",
        },
        warning: {
          DEFAULT: "#f59e0b",
          dark: "#78350f",
          light: "#fde68a",
          bg: "#2d1a00",
          border: "#d97706",
        },
        info: {
          DEFAULT: "#38bdf8",
          dark: "#0c4a6e",
          light: "#bae6fd",
          bg: "#071d2f",
          border: "#0284c7",
        },
        safe: {
          DEFAULT: "#10b981",
          dark: "#064e3b",
          light: "#a7f3d0",
          bg: "#022c22",
          border: "#059669",
        },
        compliance: {
          DEFAULT: "#64748b",
          dark: "#334155",
          light: "#cbd5e1",
          bg: "#0f172a",
        },
      },
      animation: {
        "pulse-fast": "pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "siren-glow": "sirenGlow 1.2s ease-in-out infinite",
        "border-alert": "borderFlash 1s ease-in-out infinite",
        "radar-sweep": "radarSweep 4s linear infinite",
        "fade-in": "fadeIn 0.18s ease-out forwards",
        "ticker": "tickerScroll 20s linear infinite",
        "status-pulse": "statusPulse 2s ease-in-out infinite",
      },
      keyframes: {
        sirenGlow: {
          "0%, 100%": { boxShadow: "0 0 12px rgba(239, 68, 68, 0.3)" },
          "50%": { boxShadow: "0 0 24px rgba(239, 68, 68, 0.7), 0 0 4px rgba(239, 68, 68, 0.4) inset" },
        },
        borderFlash: {
          "0%, 100%": { borderColor: "rgba(239, 68, 68, 1)", boxShadow: "0 0 18px rgba(239,68,68,0.5)" },
          "50%": { borderColor: "rgba(239, 68, 68, 0.25)", boxShadow: "0 0 4px rgba(239,68,68,0.1)" },
        },
        radarSweep: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        tickerScroll: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        statusPulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      backgroundImage: {
        "grid-industrial": "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

export default config;
