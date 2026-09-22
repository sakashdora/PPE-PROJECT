/**
 * ARGUS AI — LOCKED "FORGE" DESIGN SYSTEM TOKENS
 * Strict adherence to heavy industrial safety palette.
 * Explicitly banned: any navy, midnight-blue, indigo, violet, purple, cyan, or blue-black base.
 */

export const FORGE_TOKENS = {
  colors: {
    // Surfaces (warm carbon, brown undertone)
    base: "#16140F",
    surface: "#211D17",
    elevated: "#2C2620",
    border: "#3A332A",
    textPrimary: "#F3EFE6",
    textSecondary: "#A69C8C",

    // Brand / Functional Accents
    brand: {
      primary: "#C6752B",   // Signal Copper: primary actions, active states, brand mark
      secondary: "#1B8A5A", // Deep Jade: operational / active indicators
    },

    // Severity System (Strict Hierarchy)
    severity: {
      critical: "#C1272D",   // CRITICAL (fire/smoke) - matte safety red
      warning: "#F2760C",    // WARNING (smoking/PPE) - safety orange
      compliance: "#F2760C", // PPE alerts fall under warning tier in Forge palette
      safe: "#3E8E5A",       // SAFE / CLEAR - muted forest green
      neutral: "#7A7368",    // INFO / NEUTRAL - warm steel gray
    },
  },

  typography: {
    display: "'Bricolage Grotesque', sans-serif", // Headings, hero numbers (600-800)
    body: "'Hanken Grotesk', sans-serif",        // UI, labels, navigation
    mono: "'JetBrains Mono', monospace",         // Telemetry, metrics, alert IDs
  },

  radius: {
    none: "0px",
    sm: "2px",
    base: "4px",
    pill: "9999px", // Only allowed for bottom dock and telemetry pills
  },

  motion: {
    fast: "150ms",
    medium: "250ms",
    pulse: "1000ms", // Aviation-grade hard high-contrast pulse for CRITICAL
  },
} as const;

export default FORGE_TOKENS;
