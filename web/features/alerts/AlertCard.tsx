"use client";

import React, { useState } from "react";
import { Alert } from "@/lib/types";
import { SEVERITY } from "@/lib/severity";
import { SeverityBadge } from "@/components/SeverityBadge";
import { useAlertsStore } from "./alerts.store";
import { DICTIONARY } from "@/lib/i18n";
import {
  CheckCircle,
  AlertTriangle,
  Flame,
  Clock,
  Camera,
  MapPin,
  FileCheck,
  ChevronRight,
  ShieldX,
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

  const token = SEVERITY[alert.severity] || SEVERITY.COMPLIANCE;
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
        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${token.cardBg} ${
          isCritical && isOpen ? "animate-border-alert ring-1 ring-red-500" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <SeverityBadge severity={alert.severity} />
          <span className="text-3xs font-mono text-slate-400">
            {formatTimeAgo(alert.ts)}
          </span>
        </div>
        <div className="font-bold text-slate-100 truncate">
          {alert.type.toUpperCase()}: {alert.items.join(", ")}
        </div>
        <div className="text-3xs text-slate-400 font-mono mt-0.5 truncate">
          {alert.cameraId.toUpperCase()} · {alert.sector}
        </div>
      </div>
    );
  }

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
      className={`rounded-xl border p-4 transition-all shadow-md cursor-pointer ${token.cardBg} ${
        isCritical && isOpen ? "animate-border-alert ring-2 ring-red-500" : ""
      }`}
    >
      {/* Top Header: Badge, Status Chip, Time */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <SeverityBadge severity={alert.severity} />
          <span
            className={`px-2 py-0.5 rounded text-3xs font-mono font-bold uppercase tracking-wider ${
              isOpen
                ? "bg-red-900/60 text-red-300 border border-red-700/60 animate-pulse"
                : isAcked
                ? "bg-amber-900/60 text-amber-300 border border-amber-700/60"
                : "bg-emerald-900/60 text-emerald-300 border border-emerald-700/60"
            }`}
          >
            {alert.status.replace("_", " ")}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatTimeAgo(alert.ts)}</span>
        </div>
      </div>

      {/* Main Alert Description */}
      <div className="mb-3">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          {isCritical && <Flame className="w-4 h-4 text-red-400" />}
          {alert.type === "missing_ppe" ? (
            <span>
              {t.missing_prefix} {alert.items.map((i) => i.replace("no_", "")).join(", ").toUpperCase()}
            </span>
          ) : (
            <span>{alert.type.toUpperCase()}: {alert.items.join(", ").toUpperCase()}</span>
          )}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs font-mono text-slate-300">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">{alert.sector}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-slate-400" />
            <span>{alert.cameraId.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Confidence and Voting Metrics */}
      <div className="flex items-center justify-between py-2 px-3 bg-black/40 rounded-lg text-xs font-mono text-slate-300 border border-white/5 mb-3">
        <div>
          <span className="text-slate-400">{t.confidence}: </span>
          <span className="font-bold text-white">
            {(alert.confidence * 100).toFixed(1)}%
          </span>
        </div>
        <div>
          <span className="text-slate-400">{t.votes}: </span>
          <span className="font-bold text-emerald-400">{alert.votes}</span>
        </div>
        <div className="hidden sm:block text-slate-400 truncate max-w-[120px]">
          {alert.modelVersion}
        </div>
      </div>

      {/* Supervisor Audit Trail Note (if acknowledged or resolved) */}
      {alert.note && (
        <div className="mb-3 p-2.5 bg-black/50 border border-slate-700/60 rounded text-xs font-mono text-slate-300">
          <span className="text-amber-400 font-bold">NOTE: </span>
          <span>{alert.note}</span>
          {alert.ackBy && (
            <div className="text-3xs text-slate-500 mt-1">
              Logged by: {alert.ackBy}
            </div>
          )}
        </div>
      )}

      {/* Inline Quick Supervisor Note Input */}
      {noteOpen && (
        <div className="mb-3 p-3 bg-industrial-950 border border-industrial-700 rounded-lg" onClick={(e) => e.stopPropagation()}>
          <label htmlFor={`supervisor-note-input-${alert.id}`} className="block text-2xs font-mono text-slate-400 mb-1">
            Supervisor Log Note:
          </label>
          <input
            id={`supervisor-note-input-${alert.id}`}
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="e.g. Worker instructed to wear helmet / False steam reflection"
            className="w-full px-3 py-1.5 bg-industrial-900 border border-industrial-700 rounded text-xs text-white focus:outline-none focus:border-red-500 font-mono mb-2"
          />
          <div className="flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={() => setNoteOpen(false)}
              className="px-2 py-1 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAck}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold"
            >
              Confirm Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* Action Footer Buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {isOpen && (
            <button
              type="button"
              onClick={() => setNoteOpen(!noteOpen)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded shadow flex items-center gap-1.5 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{t.acknowledge}</span>
            </button>
          )}

          {isAcked && (
            <button
              type="button"
              onClick={handleResolve}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded shadow flex items-center gap-1.5 transition-colors"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>{t.resolve}</span>
            </button>
          )}

          {!isResolved && (
            <button
              type="button"
              onClick={handleFalseAlarm}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded flex items-center gap-1.5 transition-colors"
            >
              <ShieldX className="w-3.5 h-3.5 text-slate-400" />
              <span>{t.falseAlarm}</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onInspect?.(alert.id)}
          className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1 group"
        >
          <span>Details</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};
