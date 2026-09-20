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
        return <Flame className="w-3 h-3 text-yellow-300 animate-pulse" />;
      case "WARNING":
        return <CigaretteOff className="w-3 h-3 text-black" />;
      case "COMPLIANCE":
        return <HardHat className="w-3 h-3 text-slate-200" />;
      default:
        return null;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-3xs font-mono font-bold uppercase tracking-wider shadow-sm ${
        token.bgClass
      } ${token.textClass} ${className}`}
    >
      {showIcon && renderIcon()}
      <span>{token.label}</span>
    </span>
  );
};
