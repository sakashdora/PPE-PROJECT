"use client";

import React, { useState } from "react";
import { Alert } from "@/lib/types";
import { SeverityBadge } from "@/components/SeverityBadge";
import { useAlertsStore } from "./alerts.store";
import { DICTIONARY } from "@/lib/i18n";
import {
  CheckCircle,
  Clock,
  Camera,
  MapPin,
  FileCheck,
  ChevronRight,
  ShieldX,
  Flame,
} from "lucide-react";

interface AlertCardProps {
  alert: Alert;
  onInspect?: (id: string) => void;
  compact?: boolean;
}

export const AlertCard: React.FC<AlertCardProps> = ({
  alert,
  onInspect,
  compact = false,
}) => {
  const acknowledgeAlert = useAlertsStore((s) => s.acknowledgeAlert);
  const resolveAlert = useAlertsStore((s) => s.resolveAlert);
  const markFalseAlarm = useAlertsStore((s) => s.markFalseAlarm);
  const locale = useAlertsStore((s) => s.locale);
  const t = DICTIONARY[locale];

  const [noteOpen, setNoteOpen] = useState<boolean>(false);
  const [noteText, setNoteText] = useState<string>("");

  const isCritical = alert.severity === "CRITICAL";
  const isOpen = alert.status === "open";
  const isAcked = alert.status === "acknowledged";
  const isResolved = alert.status === "resolved" || alert.status === "false_alarm";

  const formatTimeAgo = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return t.justNow;
    const diffMin = Math.floor(diffSec / 60);
    return `${diffMin}${t.minAgo}`;
  };

  const handleAck = (e: React.MouseEvent) => {
    e.stopPropagation();
    acknowledgeAlert(alert.id, "Shift Supervisor", noteText || undefined);
    setNoteOpen(false);
  };

  const handleResolve = (e: React.MouseEvent) => {
    e.stopPropagation();
    resolveAlert(alert.id, noteText || undefined);
    setNoteOpen(false);
  };

  const handleFalseAlarm = (e: React.MouseEvent) => {
    e.stopPropagation();
    markFalseAlarm(alert.id, noteText || undefined);
    setNoteOpen(false);
  };

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onInspect?.(alert.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onInspect?.(alert.id);
          }
        }}
        className={`p-2.5 rounded-sm border text-xs cursor-pointer transition-colors hover:bg-elevated bg-surface border-border group ${
          isCritical && isOpen ? "border-critical bg-critical-bg animate-critical-pulse" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <SeverityBadge severity={alert.severity} />
          <span className="text-[9px] font-mono text-text-secondary">
            {formatTimeAgo(alert.ts)}
          </span>
        </div>
        <div className="font-bold font-display text-text-primary truncate">
          {alert.type.toUpperCase()}: {alert.items.join(", ")}
        </div>
        <div className="text-[9px] text-text-secondary font-mono mt-0.5 truncate">
          {alert.cameraId.toUpperCase()} · {alert.sector}
        </div>
      </div>
    );
  }

  const borderLeftClass = isCritical
    ? "border-l-4 border-l-critical"
    : alert.severity === "WARNING"
    ? "border-l-4 border-l-warning"
    : "border-l-4 border-l-safe";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onInspect?.(alert.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onInspect?.(alert.id);
        }
      }}
      className={`rounded-sm border p-4 sm:p-5 transition-colors cursor-pointer bg-surface hover:border-copper ${borderLeftClass} ${
        isCritical && isOpen ? "border-critical bg-critical-bg animate-critical-pulse" : "border-border"
      }`}
    >
      {/* Top Header: Badge, Status Chip, Time */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <SeverityBadge severity={alert.severity} />
          <span
            className={`px-1.5 py-0.5 rounded-sm text-[9px] font-mono font-bold uppercase tracking-wider border ${
              isOpen && isCritical
                ? "bg-critical text-text-primary border-critical"
                : isOpen && alert.severity === "WARNING"
                ? "bg-warning text-base border-warning"
                : isOpen
                ? "bg-warning text-base border-warning"
                : isAcked
                ? "bg-copper text-base border-copper"
                : "bg-safe text-text-primary border-safe"
            }`}
          >
            {isOpen && isCritical ? "CAS LATCHED" : alert.status.replace("_", " ")}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[9px] text-text-secondary font-mono">
          <Clock className="w-3 h-3 text-copper" />
          <span>{formatTimeAgo(alert.ts)}</span>
        </div>
      </div>

      {/* Main Alert Description */}
      <div className="mb-3">
        <h3 className="text-base font-bold font-display text-text-primary flex items-center gap-2">
          {isCritical && <Flame className="w-4 h-4 text-critical shrink-0" />}
          {alert.type === "missing_ppe" ? (
            <span>
              Missing {alert.items.map((i) => {
                const raw = i.replace("no_", "").replace(/_/g, " ").toLowerCase();
                if (raw.includes("hardhat") || raw.includes("helmet")) return "Hardhat";
                if (raw.includes("vest")) return "High-Vis Vest";
                if (raw.includes("gloves")) return "Thermal Gloves";
                if (raw.includes("boots")) return "Safety Boots";
                return raw.charAt(0).toUpperCase() + raw.slice(1);
              }).join(" & ")} — {alert.sector}
            </span>
          ) : alert.type === "fire" || alert.type === "smoke" ? (
            <span>Fire & Thermal Hazard — {alert.sector}</span>
          ) : alert.type === "smoking" ? (
            <span>Restricted Ignition Breach — {alert.sector}</span>
          ) : (
            <span>{String(alert.type).replace(/_/g, " ").toUpperCase()} — {alert.sector}</span>
          )}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-[10px] font-mono text-text-secondary">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-copper" />
            <span className="truncate">{alert.sector}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-copper" />
            <span>{alert.cameraId.toUpperCase().replace("CAM-", "CAM ")}</span>
          </div>
        </div>
      </div>

      {/* Confidence and Voting Metrics */}
      <div className="flex items-center justify-between py-2 px-3 bg-base rounded-sm text-[9px] font-mono text-text-secondary border border-border mb-3">
        <div>
          <span>{t.confidence}: </span>
          <span className="font-bold text-text-primary">
            {(alert.confidence * 100).toFixed(1)}%
          </span>
        </div>
        <div>
          <span>{t.votes}: </span>
          <span className="font-bold text-copper">{alert.votes} FRAMES</span>
        </div>
        <div className="hidden sm:block text-text-secondary truncate max-w-[140px]">
          MODEL: {alert.modelVersion || "yolo11s_s2"}
        </div>
      </div>

      {/* Supervisor Audit Trail Note */}
      {alert.note && (
        <div className="mb-3 p-2.5 bg-base border border-border rounded-sm text-[10px] font-mono text-text-secondary">
          <span className="text-warning font-bold">NOTE: </span>
          <span className="text-text-primary">{alert.note}</span>
          {alert.ackBy && (
            <div className="text-[9px] text-text-secondary mt-1">
              Logged by: {alert.ackBy}
            </div>
          )}
        </div>
      )}

      {/* Inline Quick Supervisor Note Input */}
      {noteOpen && (
        <div className="mb-3 p-3 bg-elevated border border-border rounded-sm" onClick={(e) => e.stopPropagation()}>
          <label htmlFor={`supervisor-note-input-${alert.id}`} className="block text-[9px] font-mono text-text-secondary mb-1 uppercase">
            Supervisor CAS Log Note:
          </label>
          <input
            id={`supervisor-note-input-${alert.id}`}
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="e.g. Worker instructed to wear helmet / False steam reflection"
            className="w-full px-3 py-1.5 bg-base border border-border rounded-sm text-xs text-text-primary focus:outline-none focus:border-copper font-mono mb-2 transition-colors"
          />
          <div className="flex justify-end gap-2 text-[10px] font-mono font-medium">
            <button
              type="button"
              onClick={() => setNoteOpen(false)}
              className="px-2 py-1 text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAck}
              className="px-3 py-1 bg-warning hover:bg-warning/80 text-base font-bold rounded-sm transition-colors"
            >
              Confirm Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* Action Footer Buttons */}
      <div className="flex items-center justify-between pt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {isOpen && (
            <button
              type="button"
              onClick={() => setNoteOpen(!noteOpen)}
              className="px-3 py-1.5 bg-warning hover:bg-warning/80 text-base font-bold font-mono text-[10px] uppercase rounded-sm flex items-center gap-1.5 transition-colors"
            >
              <CheckCircle className="w-3 h-3" />
              <span>{t.acknowledge}</span>
            </button>
          )}

          {isAcked && (
            <button
              type="button"
              onClick={handleResolve}
              className="px-3 py-1.5 bg-safe hover:bg-safe/80 text-text-primary font-bold font-mono text-[10px] uppercase rounded-sm flex items-center gap-1.5 transition-colors"
            >
              <FileCheck className="w-3 h-3" />
              <span>{t.resolve}</span>
            </button>
          )}

          {!isResolved && (
            <button
              type="button"
              onClick={handleFalseAlarm}
              className="px-2.5 py-1.5 bg-elevated hover:bg-base text-text-secondary hover:text-text-primary font-medium font-mono text-[10px] uppercase border border-border rounded-sm flex items-center gap-1.5 transition-colors"
            >
              <ShieldX className="w-3 h-3 text-copper" />
              <span>{t.falseAlarm}</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onInspect?.(alert.id)}
          className="text-[10px] font-mono text-copper hover:underline flex items-center gap-1 group transition-colors"
        >
          <span>CAS Audit Sheet</span>
          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};
