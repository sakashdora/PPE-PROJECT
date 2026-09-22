import { Severity } from "./types";

export const SEVERITY = {
  CRITICAL: {
    label: "CRITICAL",
    rank: 0,
    icon: "Flame",
    bgClass: "bg-critical",
    borderClass: "border-critical",
    textClass: "text-text-primary",
    cardBg: "bg-critical/15 border-critical hover:bg-critical/25",
    colorHex: "#C1272D",
    pulseClass: "animate-critical-pulse",
    sticky: true,
  },
  WARNING: {
    label: "WARNING",
    rank: 1,
    icon: "CigaretteOff",
    bgClass: "bg-warning",
    borderClass: "border-warning",
    textClass: "text-base",
    cardBg: "bg-surface border-warning hover:bg-elevated",
    colorHex: "#F2760C",
    pulseClass: "",
    sticky: false,
  },
  COMPLIANCE: {
    label: "COMPLIANCE",
    rank: 2,
    icon: "HardHat",
    bgClass: "bg-warning",
    borderClass: "border-warning",
    textClass: "text-base",
    cardBg: "bg-surface border-border hover:bg-elevated",
    colorHex: "#F2760C",
    pulseClass: "",
    sticky: false,
  },
  SAFE: {
    label: "SAFE",
    rank: 3,
    icon: "CheckCircle2",
    bgClass: "bg-safe",
    borderClass: "border-safe",
    textClass: "text-text-primary",
    cardBg: "bg-surface border-safe hover:bg-elevated",
    colorHex: "#3E8E5A",
    pulseClass: "",
    sticky: false,
  },
} as const;

export const SEVERITY_RANK: Record<Severity, number> = {
  CRITICAL: 0,
  WARNING: 1,
  COMPLIANCE: 2,
};
