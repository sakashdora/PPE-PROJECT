"use client";

import React, { useState } from "react";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import { selectQueue } from "@/features/alerts/selectors";
import { StreamTile } from "@/features/wall/StreamTile";
import { AlertDrawer } from "@/features/alerts/AlertDrawer";
import { CameraStream, Alert } from "@/lib/types";
import {
  RadioTower,
  ChevronDown,
  LayoutGrid,
  List,
  Bell,
  ChevronRight,
  Flame,
  AlertTriangle,
  Info,
  CheckCircle2,
  Camera,
} from "lucide-react";
import Link from "next/link";

const DEMO_CAMERAS: CameraStream[] = [
  {
    id: "cam-01",
    name: "Camera 01",
    sector: "Sector 1",
    location: "Loading Bay & Logistics",
    sourceType: "file",
    sourceUrl: "/streams/cam01.mp4",
    status: "online",
    fps: 14.8,
    latencyMs: 32,
    lastSeen: "2026-09-19T22:50:00.000Z",
    resolution: "1920x1080",
    activeAlertCount: 0,
    hasCritical: false,
  },
  {
    id: "cam-02",
    name: "Camera 02",
    sector: "Sector 2",
    location: "Chemical Storage & Flammables",
    sourceType: "file",
    sourceUrl: "/streams/cam02.mp4",
    status: "online",
    fps: 15.1,
    latencyMs: 29,
    lastSeen: "2026-09-19T22:50:00.000Z",
    resolution: "1920x1080",
    activeAlertCount: 0,
    hasCritical: false,
  },
  {
    id: "cam-03",
    name: "Camera 03",
    sector: "Sector 3",
    location: "Precision Assembly Line",
    sourceType: "file",
    sourceUrl: "/streams/cam03.mp4",
    status: "online",
    fps: 14.6,
    latencyMs: 35,
    lastSeen: "2026-09-19T22:50:00.000Z",
    resolution: "1920x1080",
    activeAlertCount: 0,
    hasCritical: false,
  },
  {
    id: "cam-04",
    name: "Camera 04",
    sector: "Sector 4",
    location: "High-Heat Furnace Hall",
    sourceType: "file",
    sourceUrl: "/streams/cam04.mp4",
    status: "online",
    fps: 15.0,
    latencyMs: 31,
    lastSeen: "2026-09-19T22:50:00.000Z",
    resolution: "1920x1080",
    activeAlertCount: 0,
    hasCritical: false,
  },
];

type LayoutPreset = "2x2" | "3x3" | "4x4";
type AlertFilter = "all" | "critical" | "warning" | "info";

// ── Compact Alert Queue Card ──────────────────────────────────────────────────
function AlertQueueCard({
  alert,
  onInspect,
}: {
  alert: Alert;
  onInspect: (id: string) => void;
}) {
  const isCritical = alert.severity === "CRITICAL";
  const isWarning = alert.severity === "WARNING";
  const isInfo = alert.severity === "COMPLIANCE";

  const timeAgo = (() => {
    const diff = Math.floor((Date.now() - new Date(alert.ts).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  })();

  const timeFormatted = new Date(alert.ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const alertTypeStr = alert.type as string;
  const title = alertTypeStr === "fire" || alertTypeStr === "smoke"
    ? "Fire / Smoke Detected"
    : alertTypeStr === "missing_ppe"
    ? `${alert.items.map((i: string) => i.replace("no_", "").replace(/_/g, " ")).join(" & ")} Not Detected`
    : alertTypeStr === "smoking"
    ? "Smoking in Restricted Zone"
    : alertTypeStr.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

  const desc = isCritical
    ? `High smoke density detected (confidence ${(alert.confidence * 100).toFixed(2)})`
    : isWarning
    ? `Worker without ${alert.items.join(", ")} (confidence ${(alert.confidence * 100).toFixed(2)})`
    : "System event recorded";

  const modelTag = alert.modelVersion || (isCritical ? "fire_v2" : "ppe_v2");
  const typeTag = isCritical ? "Fire" : isWarning ? "PPE" : "System";

  const severityBar = isCritical
    ? "bg-red-500"
    : isWarning
    ? "bg-amber-500"
    : "bg-sky-500";

  const severityBadge = isCritical
    ? "bg-red-900/50 text-red-300 border-red-700/50"
    : isWarning
    ? "bg-amber-900/50 text-amber-300 border-amber-700/50"
    : "bg-sky-900/50 text-sky-300 border-sky-700/50";

  const severityText = isCritical ? "CRITICAL" : isWarning ? "WARNING" : "INFO";
  const SevIcon = isCritical ? Flame : isWarning ? AlertTriangle : Info;

  return (
    <button
      type="button"
      onClick={() => onInspect(alert.id)}
      className={`w-full text-left flex gap-0 rounded-lg overflow-hidden border transition-all hover:border-industrial-600 hover:bg-industrial-800/30 group ${
        isCritical && alert.status === "open"
          ? "border-red-700/60 bg-red-950/20 animate-border-alert"
          : "border-industrial-750 bg-industrial-900/60"
      }`}
    >
      {/* Severity color bar */}
      <div className={`w-1 shrink-0 ${severityBar}`} />

      {/* Content */}
      <div className="flex-1 px-3 py-2.5 min-w-0">
        {/* Row 1: Badge + time */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className={`flex items-center gap-1 text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded border ${severityBadge}`}>
              <SevIcon className="w-2.5 h-2.5" />
              {severityText}
            </span>
          </div>
          <span className="text-[9px] font-mono text-slate-500 whitespace-nowrap">
            {timeFormatted} · {timeAgo}
          </span>
        </div>

        {/* Row 2: Title */}
        <div className="text-[12px] font-bold text-slate-100 leading-tight mb-1 truncate">
          {title}
        </div>

        {/* Row 3: Camera + Sector */}
        <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400 mb-1.5">
          <Camera className="w-2.5 h-2.5 text-slate-500" />
          <span>{alert.cameraId.toUpperCase().replace("CAM-", "Camera ")}</span>
          <span className="opacity-40">·</span>
          <span>{alert.sector}</span>
        </div>

        {/* Row 4: Description */}
        <div className="text-[10px] text-slate-500 font-mono leading-tight mb-2 truncate">
          {desc}
        </div>

        {/* Row 5: Tags */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-industrial-800 border border-industrial-700 text-slate-300">
            {typeTag}
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-industrial-800 border border-industrial-700 text-slate-400">
            Model: {modelTag}
          </span>
        </div>
      </div>

      {/* Chevron */}
      <div className="flex items-center pr-2 text-slate-600 group-hover:text-slate-300 transition-colors">
        <ChevronRight className="w-4 h-4" />
      </div>
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LiveWallPage() {
  const byId = useAlertsStore((s) => s.byId);
  const selectedAlertId = useAlertsStore((s) => s.selectedAlertId);
  const setSelectedAlertId = useAlertsStore((s) => s.setSelectedAlertId);

  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>("2x2");
  const [focusedCamId, setFocusedCamId] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");
  const [sectorFilter] = useState<string>("all");

  const queue = selectQueue(byId);
  const activeAlerts = queue.filter((a) => a.status === "open" || a.status === "acknowledged");
  const selectedAlert = selectedAlertId ? byId[selectedAlertId] || null : null;

  const criticalAlerts = activeAlerts.filter((a) => a.severity === "CRITICAL");
  const warningAlerts = activeAlerts.filter((a) => a.severity === "WARNING");
  const infoAlerts = activeAlerts.filter(
    (a) => a.severity === "COMPLIANCE"
  );

  const filteredAlerts =
    alertFilter === "critical" ? criticalAlerts
    : alertFilter === "warning" ? warningAlerts
    : alertFilter === "info" ? infoAlerts
    : activeAlerts;

  // Sort cameras: CRITICAL pinned to top
  const sortedCameras = [...DEMO_CAMERAS].sort((a, b) => {
    const aCrit = Object.values(byId).some(
      (al) => al.cameraId === a.id && al.severity === "CRITICAL" && al.status === "open"
    );
    const bCrit = Object.values(byId).some(
      (al) => al.cameraId === b.id && al.severity === "CRITICAL" && al.status === "open"
    );
    if (aCrit && !bCrit) return -1;
    if (!aCrit && bCrit) return 1;
    return a.id.localeCompare(b.id);
  });

  const displayedCameras = focusedCamId
    ? sortedCameras.filter((c) => c.id === focusedCamId)
    : sortedCameras;

  const gridColsClass =
    layoutPreset === "4x4" ? "grid-cols-4"
    : layoutPreset === "3x3" ? "grid-cols-3"
    : "grid-cols-2";

  // Auto-rows: each row gets equal share of available height
  const gridRowsClass =
    layoutPreset === "4x4" ? "grid-rows-4"
    : layoutPreset === "3x3" ? "grid-rows-3"
    : "grid-rows-2";

  const tabFilters: { key: AlertFilter; label: string; count: number; color: string }[] = [
    { key: "all", label: "All", count: activeAlerts.length, color: "text-slate-300" },
    { key: "critical", label: "Critical", count: criticalAlerts.length, color: "text-red-400" },
    { key: "warning", label: "Warning", count: warningAlerts.length, color: "text-amber-400" },
    { key: "info", label: "Info", count: infoAlerts.length, color: "text-sky-400" },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════════
          LEFT: Live Wall Grid
      ═══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-industrial-800 min-w-0">
        {/* Title Row */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-industrial-800 shrink-0 bg-industrial-900/50">
          <div>
            <h1 className="text-[15px] font-black text-white tracking-tight flex items-center gap-2">
              <RadioTower className="w-4 h-4 text-emerald-400 animate-pulse" />
              Live Wall — Multi-Stream Grid
            </h1>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              Real-time inference wall · {DEMO_CAMERAS.length} edge streams active · Zero cloud latency
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Layout Switcher */}
            <div className="flex items-center gap-0.5 bg-industrial-900 border border-industrial-750 rounded-lg p-0.5">
              {(["2x2", "3x3", "4x4"] as LayoutPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => { setLayoutPreset(preset); setFocusedCamId(null); }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold font-mono transition-all ${
                    layoutPreset === preset
                      ? "bg-blue-600 text-white shadow"
                      : "text-slate-400 hover:text-white hover:bg-industrial-750"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Sector Filter */}
            <button
              type="button"
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-industrial-900 border border-industrial-750 rounded-lg text-[11px] font-mono text-slate-300 hover:text-white hover:border-industrial-600 transition-all"
            >
              <span className="text-slate-500">📍</span>
              <span>All Sectors</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-0.5 bg-industrial-900 border border-industrial-750 rounded-lg p-0.5">
              <button
                type="button"
                className="p-1.5 rounded bg-industrial-700 text-white"
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-industrial-750 transition-colors"
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Camera Grid — fills all remaining height, tiles auto-size to fit */}
        <div className="flex-1 min-h-0 overflow-hidden p-2.5">
          <div
            className={`h-full grid gap-2 ${
              focusedCamId
                ? "grid-cols-1 grid-rows-1"
                : `${gridColsClass} ${gridRowsClass}`
            }`}
          >
            {displayedCameras.map((camera) => {
              const camAlerts = Object.values(byId).filter(
                (a) => a.cameraId === camera.id
              );
              return (
                <StreamTile
                  key={camera.id}
                  camera={camera}
                  alerts={camAlerts}
                  onSelectAlert={(id) => setSelectedAlertId(id)}
                  isExpanded={focusedCamId === camera.id}
                  onToggleExpand={() =>
                    setFocusedCamId(focusedCamId === camera.id ? null : camera.id)
                  }
                />
              );
            })}
          </div>

          {focusedCamId && (
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => setFocusedCamId(null)}
                className="text-[11px] font-mono text-slate-400 hover:text-white underline"
              >
                ← Return to {layoutPreset} grid
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          RIGHT: Alert Queue Panel (360px fixed)
      ═══════════════════════════════════════════════════════════════ */}
      <div className="w-[360px] shrink-0 flex flex-col overflow-hidden bg-industrial-900/60">
        {/* Panel Header */}
        <div className="px-4 pt-3 pb-2 border-b border-industrial-800 shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[13px] font-bold text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-400" />
              ALERT QUEUE
              {activeAlerts.length > 0 && (
                <span className="text-[10px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full leading-none">
                  {activeAlerts.length}
                </span>
              )}
            </h2>
            <Link
              href="/alerts"
              className="flex items-center gap-1 text-[11px] font-mono text-blue-400 hover:text-blue-300 transition-colors"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1">
            {tabFilters.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setAlertFilter(tab.key)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold font-mono transition-all ${
                  alertFilter === tab.key
                    ? "bg-industrial-750 text-white border border-industrial-600"
                    : "text-slate-500 hover:text-slate-300 hover:bg-industrial-800/50"
                }`}
              >
                {tab.key === "critical" && <Flame className="w-2.5 h-2.5 text-red-400" />}
                {tab.key === "warning" && <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />}
                {tab.key === "info" && <Info className="w-2.5 h-2.5 text-sky-400" />}
                <span className={alertFilter === tab.key ? "text-white" : tab.color}>
                  {tab.label}
                </span>
                <span
                  className={`px-1 rounded text-[9px] ${
                    alertFilter === tab.key
                      ? "bg-industrial-600 text-slate-200"
                      : "text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Alert List */}
        <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2">
          {filteredAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-2" />
              <p className="text-[11px] font-mono text-slate-500">
                {alertFilter === "all"
                  ? "No active violations"
                  : `No ${alertFilter} alerts`}
              </p>
              <p className="text-[10px] font-mono text-slate-600 mt-0.5">
                All monitored sectors clear
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <AlertQueueCard
                key={alert.id}
                alert={alert}
                onInspect={(id) => setSelectedAlertId(id)}
              />
            ))
          )}
        </div>

        {/* Panel Footer */}
        {activeAlerts.length > 0 && (
          <div className="px-4 py-2 border-t border-industrial-800 shrink-0">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {criticalAlerts.length} critical
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {warningAlerts.length} warning
                </span>
              </div>
              <span className="text-slate-600">
                Sorted by severity
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Alert Details Drawer */}
      <AlertDrawer
        alert={selectedAlert}
        onClose={() => setSelectedAlertId(null)}
      />
    </div>
  );
}
