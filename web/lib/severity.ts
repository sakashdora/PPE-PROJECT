import { Severity } from "./types";

export const SEVERITY = {
  CRITICAL: {
    label: "CRITICAL",
    rank: 0,
    icon: "Flame",
    bgClass: "bg-red-600",
    borderClass: "border-red-500",
    textClass: "text-white",
    cardBg: "bg-red-950/40 border-red-800/60 hover:border-red-600",
    pulseClass: "animate-siren-glow",
    sticky: true,
  },
  WARNING: {
    label: "WARNING",
    rank: 1,
    icon: "CigaretteOff",
    bgClass: "bg-amber-500",
    borderClass: "border-amber-400",
    textClass: "text-black",
    cardBg: "bg-amber-950/30 border-amber-800/50 hover:border-amber-500",
    pulseClass: "",
    sticky: false,
  },
  COMPLIANCE: {
    label: "COMPLIANCE",
    rank: 2,
    icon: "HardHat",
    bgClass: "bg-slate-700",
    borderClass: "border-slate-500",
    textClass: "text-slate-100",
    cardBg: "bg-slate-900/60 border-slate-700/60 hover:border-slate-500",
    pulseClass: "",
    sticky: false,
  },
} as const;

export const SEVERITY_RANK: Record<Severity, number> = {
  CRITICAL: 0,
  WARNING: 1,
  COMPLIANCE: 2,
};
