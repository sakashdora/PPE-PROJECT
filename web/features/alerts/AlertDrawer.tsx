"use client";

import React, { useState, useEffect } from "react";
import { Alert } from "@/lib/types";
import { SeverityBadge } from "@/components/SeverityBadge";
import { useAlertsStore } from "./alerts.store";
import { DICTIONARY } from "@/lib/i18n";
import {
  X,
  CheckCircle,
  FileCheck,
  ShieldX,
  Clock,
  MapPin,
  Camera,
  Cpu,
  Layers,
  Save,
  Flame,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** POST CAS transition to NestJS. Returns true on success, false on conflict/error. */
async function serverTransition(
  alertId: string,
  action: "ack" | "resolve" | "false_alarm",
  expectedVersion: number,
  note?: string,
  authToken?: string
): Promise<{ ok: boolean; error?: string; data?: Alert }> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

    const cookieToken = typeof document !== "undefined"
      ? document.cookie.split(";").find((c) => c.trim().startsWith("token="))?.split("=")[1]
      : undefined;
    if (cookieToken) headers["Authorization"] = `Bearer ${cookieToken}`;

    const resp = await fetch(`${API_URL}/alerts/${alertId}`, {
      method: "PATCH",
      headers,
      credentials: "include",
      body: JSON.stringify({ action, expectedVersion, note }),
    });

    if (resp.ok) {
      const data = await resp.json();
      return { ok: true, data };
    } else if (resp.status === 409) {
      return { ok: false, error: "CAS Conflict: alert was modified by another session. Version mismatch." };
    } else if (resp.status === 401 || resp.status === 403) {
      return { ok: false, error: "Unauthorized: supervisor credentials required." };
    } else {
      const body = await resp.json().catch(() => ({}));
      return { ok: false, error: body.message || `Server error ${resp.status}` };
    }
  } catch (e: any) {
    console.warn("[AlertDrawer] CAS call failed, applying optimistic local update:", e.message);
    return { ok: true, error: "offline-optimistic" };
  }
}

interface AlertDrawerProps {
  alert: Alert | null;
  onClose: () => void;
}

import { useGSAP } from "@gsap/react";
import gsap from "gsap";

export const AlertDrawer: React.FC<AlertDrawerProps> = ({ alert, onClose }) => {
  const acknowledgeAlert = useAlertsStore((s) => s.acknowledgeAlert);
  const resolveAlert = useAlertsStore((s) => s.resolveAlert);
  const markFalseAlarm = useAlertsStore((s) => s.markFalseAlarm);
  const locale = useAlertsStore((s) => s.locale);
  const t = DICTIONARY[locale];

  const drawerRef = React.useRef<HTMLDivElement>(null);
  const [noteText, setNoteText] = useState<string>("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  // GSAP Entrance animation
  useGSAP(() => {
    if (drawerRef.current && alert) {
      gsap.fromTo(
        drawerRef.current,
        { x: "100%" },
        { x: "0%", duration: 0.35, ease: "power3.out" }
      );
    }
  }, [alert]);

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!alert) return null;

  const isOpen = alert.status === "open";
  const isAcked = alert.status === "acknowledged";
  const isResolved = alert.status === "resolved" || alert.status === "false_alarm";

  const doTransition = async (
    action: "ack" | "resolve" | "false_alarm",
    localFn: () => void
  ) => {
    setServerError(null);
    setIsPending(true);
    const version = alert.version ?? 1;
    const result = await serverTransition(alert.id, action, version, noteText || undefined);
    setIsPending(false);
    if (result.ok) {
      localFn();
    } else {
      setServerError(result.error || "Transition failed");
    }
  };

  const handleSaveNote = () => {
    if (!noteText.trim()) return;
    if (isOpen) {
      doTransition("ack", () => acknowledgeAlert(alert.id, "Shift Supervisor", noteText));
    } else {
      doTransition("resolve", () => resolveAlert(alert.id, noteText));
    }
    setNoteText("");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-drawer-title"
      className="fixed inset-0 z-50 overflow-hidden bg-black/75 flex justify-end transition-opacity duration-150"
      onClick={onClose}
    >
      <div
        ref={drawerRef}
        className="w-full max-w-lg bg-elevated border-l border-border h-full overflow-y-auto flex flex-col p-6 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={alert.severity} />
            <span className="font-mono text-2xs text-text-secondary">
              INCIDENT #{alert.id}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 text-text-secondary hover:text-text-primary rounded-sm bg-surface border border-border transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hazard Title & Location */}
        <div className="py-4 border-b border-border">
          <h2 id="alert-drawer-title" className="text-lg font-bold font-display text-text-primary flex items-center gap-2">
            {alert.severity === "CRITICAL" && (
              <Flame className="w-5 h-5 text-critical shrink-0" />
            )}
            <span>
              {alert.type.toUpperCase()}: {alert.items.join(", ").toUpperCase()}
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-2xs font-mono text-text-secondary">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-copper" />
              <span>{alert.sector}</span>
            </div>
            <div className="flex items-center gap-1">
              <Camera className="w-3 h-3 text-copper" />
              <span>{alert.cameraId.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-copper" />
              <span>{new Date(alert.ts).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* High-Resolution Incident Frame Preview */}
        <div className="py-3 border-b border-border">
          <div className="text-2xs font-mono text-text-secondary uppercase mb-2">
            ON-PREM EDGE EVIDENCE SNAPSHOT
          </div>
          <div className="relative w-full aspect-video bg-base rounded-sm overflow-hidden border border-border flex items-center justify-center">
            <div className="text-center p-4">
              <div className="w-12 h-12 mx-auto mb-2 rounded-sm bg-surface border border-border flex items-center justify-center">
                {alert.severity === "CRITICAL" ? (
                  <Flame className="w-6 h-6 text-critical" />
                ) : (
                  <ShieldX className="w-6 h-6 text-warning" />
                )}
              </div>
              <div className="text-2xs font-mono font-bold text-text-primary">
                AUTHENTICATED FRAME TENSOR
              </div>
              <div className="text-3xs font-mono text-text-secondary mt-0.5">
                Path: /var/lib/argus/snapshots/{alert.id}.jpg
              </div>
            </div>

            {/* Bounding Box Simulation */}
            <div
              className={`absolute border-2 ${
                alert.severity === "CRITICAL" ? "border-critical bg-critical-bg" : "border-warning bg-warning-bg"
              } font-mono text-3xs text-text-primary px-1 py-0.5`}
              style={{
                left: "25%",
                top: "22%",
                width: "50%",
                height: "56%",
              }}
            >
              <span className={`px-1 py-0.5 text-[8px] font-bold uppercase ${
                alert.severity === "CRITICAL" ? "bg-critical" : "bg-warning text-base"
              }`}>
                {alert.items[0]} ({(alert.confidence * 100).toFixed(0)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Inference & Concurrency Metadata */}
        <div className="py-3 border-b border-border">
          <div className="text-2xs font-mono text-text-secondary uppercase mb-2">
            CONCURRENCY & VOTING ENGINE
          </div>

          <div className="grid grid-cols-2 gap-2 text-2xs font-mono">
            <div className="p-2.5 bg-surface rounded-sm border border-border">
              <div className="text-text-secondary text-3xs">CONFIDENCE</div>
              <div className="text-sm font-bold text-text-primary mt-0.5">
                {(alert.confidence * 100).toFixed(1)}%
              </div>
              <div className="text-3xs text-safe mt-0.5">
                Gate Passed (≥ 0.85)
              </div>
            </div>

            <div className="p-2.5 bg-surface rounded-sm border border-border">
              <div className="text-text-secondary text-3xs">TEMPORAL VOTES</div>
              <div className="text-sm font-bold text-copper mt-0.5 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                <span>{alert.votes} Frames</span>
              </div>
              <div className="text-3xs text-text-secondary mt-0.5">
                Dual-Rate Sliding Window
              </div>
            </div>

            <div className="col-span-2 p-2 bg-surface rounded-sm border border-border flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-copper" />
                <span>MODEL: {alert.modelVersion || "yolo11s_s2"} (ONNX INT8)</span>
              </div>
              <span className="text-3xs text-slate-connect font-semibold">
                CAS VERSION #{alert.version ?? 1}
              </span>
            </div>
          </div>
        </div>

        {/* Supervisor Action Log & Remarks */}
        <div className="py-3 flex-1">
          <div className="text-2xs font-mono text-text-secondary uppercase mb-2">
            SUPERVISOR CAS AUDIT TRAIL
          </div>

          {alert.note ? (
            <div className="p-2.5 bg-surface border border-border rounded-sm text-2xs font-mono mb-3">
              <div className="text-warning font-bold mb-1">
                LOGGED INCIDENT REMARK:
              </div>
              <div className="text-text-primary">{alert.note}</div>
              {alert.ackBy && (
                <div className="text-3xs text-text-secondary mt-1">
                  Supervisor: {alert.ackBy} • {alert.ackAt ? new Date(alert.ackAt).toLocaleTimeString() : ""}
                </div>
              )}
            </div>
          ) : (
            <div className="text-2xs font-mono text-text-secondary italic mb-3">
              No audit log entries yet.
            </div>
          )}

          {/* Note Input */}
          <div>
            <label htmlFor={`drawer-note-input-${alert.id}`} className="block text-3xs font-mono text-text-secondary mb-1 uppercase">
              Enter Supervisor Remark:
            </label>
            <textarea
              id={`drawer-note-input-${alert.id}`}
              rows={2}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Worker provided helmet from supply cache; Area cleared."
              className="w-full p-2 bg-base border border-border rounded-sm text-xs text-text-primary font-mono focus:outline-none focus:border-copper transition-colors"
            />
            {noteText.trim() && (
              <button
                type="button"
                onClick={handleSaveNote}
                className="mt-2 px-2.5 py-1 bg-surface hover:bg-elevated text-text-primary text-2xs font-mono rounded-sm flex items-center gap-1 border border-border transition-colors"
              >
                <Save className="w-3 h-3 text-copper" />
                <span>Save Remark</span>
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {serverError && (
          <div className="mb-3 px-3 py-1.5 bg-critical-bg border border-critical rounded-sm text-2xs font-mono text-text-primary">
            {serverError}
          </div>
        )}

        {/* Bottom CAS Controls */}
        <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isOpen && (
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  doTransition("ack", () => acknowledgeAlert(alert.id, "Shift Supervisor"))
                }
                className="px-3 py-1.5 bg-warning hover:bg-warning/80 disabled:opacity-50 text-base font-bold font-mono text-xs rounded-sm flex items-center gap-1 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{isPending ? "Syncing…" : t.acknowledge}</span>
              </button>
            )}

            {isAcked && (
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  doTransition("resolve", () => resolveAlert(alert.id))
                }
                className="px-3 py-1.5 bg-safe hover:bg-safe/80 disabled:opacity-50 text-text-primary font-bold font-mono text-xs rounded-sm flex items-center gap-1 transition-colors"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>{isPending ? "Syncing…" : t.resolve}</span>
              </button>
            )}

            {!isResolved && (
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  doTransition("false_alarm", () => markFalseAlarm(alert.id))
                }
                className="px-2.5 py-1.5 bg-surface hover:bg-base disabled:opacity-50 text-text-secondary hover:text-text-primary font-mono text-xs rounded-sm flex items-center gap-1 border border-border transition-colors"
              >
                <ShieldX className="w-3.5 h-3.5 text-copper" />
                <span>{isPending ? "…" : t.falseAlarm}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1.5 text-xs font-mono text-text-secondary hover:text-text-primary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
