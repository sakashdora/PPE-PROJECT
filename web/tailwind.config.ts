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
        display: ["'Bricolage Grotesque'", "sans-serif"],
        sans: ["'Hanken Grotesk'", "sans-serif"],
        body: ["'Hanken Grotesk'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      fontSize: {
        "3xs": ["0.62rem", { lineHeight: "0.85rem" }],
        "2xs": ["0.7rem", { lineHeight: "0.95rem" }],
      },
      colors: {
        // Forge Surfaces
        base: "#16140F",
        canvas: {
          DEFAULT: "#16140F",
        },
        surface: {
          DEFAULT: "#211D17",
          elevated: "#2C2620",
        },
        elevated: {
          DEFAULT: "#2C2620",
        },
        border: {
          DEFAULT: "#3A332A",
        },
        depth: {
          DEFAULT: "#3A332A",
          border: "#3A332A",
        },

        // Brand Accents
        copper: {
          DEFAULT: "#C6752B",
          hover: "#B26521",
          light: "rgba(198, 117, 43, 0.15)",
        },
        jade: {
          DEFAULT: "#1B8A5A",
          light: "rgba(27, 138, 90, 0.15)",
        },

        // Backward-compatible nominal mapped to Signal Copper / Jade
        nominal: {
          DEFAULT: "#C6752B",
          bg: "rgba(198, 117, 43, 0.15)",
        },
        telemetry: {
          DEFAULT: "#A69C8C",
        },

        // Severity System
        critical: {
          DEFAULT: "#C1272D",
          dark: "#681216",
          bg: "rgba(193, 39, 45, 0.18)",
          border: "#C1272D",
        },
        warning: {
          DEFAULT: "#F2760C",
          dark: "#7E3902",
          bg: "rgba(242, 118, 12, 0.18)",
          border: "#F2760C",
        },
        compliance: {
          DEFAULT: "#F2760C",
          dark: "#7E3902",
          bg: "rgba(242, 118, 12, 0.18)",
          border: "#F2760C",
        },
        safe: {
          DEFAULT: "#3E8E5A",
          dark: "#1B4729",
          bg: "rgba(62, 142, 90, 0.18)",
          border: "#3E8E5A",
        },
        neutral: {
          DEFAULT: "#7A7368",
          dark: "#3B3731",
          bg: "rgba(122, 115, 104, 0.18)",
        },

        text: {
          primary: "#F3EFE6",
          secondary: "#A69C8C",
        },
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "4px",
      },
      animation: {
        "hard-pulse": "hardPulse 1s steps(2, start) infinite",
        "ticker": "tickerScroll 24s linear infinite",
      },
      keyframes: {
        hardPulse: {
          "0%, 100%": { opacity: "1", borderColor: "#C1272D" },
          "50%": { opacity: "0.3", borderColor: "transparent" },
        },
        tickerScroll: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
