import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Bricolage Grotesque'", "sans-serif"],
        serif: ["'DM Serif Display'", "serif"],
        sans: ["'Hanken Grotesk'", "sans-serif"],
        body: ["'Hanken Grotesk'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      fontSize: {
        "3xs": ["0.62rem", { lineHeight: "0.85rem" }],
        "2xs": ["0.7rem", { lineHeight: "0.95rem" }],
      },
      colors: {
        base: "var(--base)",
        surface: {
          DEFAULT: "var(--surface)",
          elevated: "var(--elevated)",
          warm: "var(--surface-warm)",
        },
        elevated: {
          DEFAULT: "var(--elevated)",
          warm: "var(--elevated-warm)",
        },
        border: {
          DEFAULT: "var(--border)",
          subtle: "var(--border-subtle)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          display: "var(--text-display)",
        },
        brand: {
          accent: "var(--brand-accent)",
          hover: "var(--brand-accent-hover)",
          subtle: "var(--brand-accent-subtle)",
          glow: "var(--brand-glow)",
        },
        slate: {
          connect: "var(--slate-connect)",
          subtle: "var(--slate-connect-subtle)",
        },
        personality: {
          rose: "var(--personality-rose)",
          subtle: "var(--personality-rose-subtle)",
        },
        critical: {
          DEFAULT: "var(--critical)",
          bg: "var(--critical-bg)",
          dark: "var(--critical-dark)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          bg: "var(--warning-bg)",
          dark: "var(--warning-dark)",
        },
        compliance: {
          DEFAULT: "var(--compliance)",
          bg: "var(--compliance-bg)",
          dark: "var(--compliance-dark)",
        },
        safe: {
          DEFAULT: "var(--safe)",
          bg: "var(--safe-bg)",
          dark: "var(--safe-dark)",
        },
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "4px",
      },
    },
  },
  plugins: [],
};

export default config;
