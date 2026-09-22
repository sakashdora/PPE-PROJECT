import React from "react";
import { Severity } from "@/lib/types";
import { SEVERITY } from "@/lib/severity";
import { Flame, CigaretteOff, HardHat } from "lucide-react";

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
  showIcon?: boolean;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({
  severity,
  className = "",
  showIcon = true,
}) => {
  const token = SEVERITY[severity] || SEVERITY.COMPLIANCE;

  const renderIcon = () => {
    switch (severity) {
      case "CRITICAL":
        return <Flame className="w-2.5 h-2.5 text-text-primary" />;
      case "WARNING":
        return <CigaretteOff className="w-2.5 h-2.5 text-base" />;
      case "COMPLIANCE":
        return <HardHat className="w-2.5 h-2.5 text-base" />;
      default:
        return null;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] font-mono font-bold uppercase tracking-wider ${
        severity === "CRITICAL"
          ? "bg-critical text-text-primary border border-critical"
          : severity === "WARNING"
          ? "bg-warning text-base font-semibold border border-warning"
          : "bg-safe text-text-primary border border-safe"
      } ${className}`}
    >
      {showIcon && renderIcon()}
      <span>{token.label}</span>
    </span>
  );
};
