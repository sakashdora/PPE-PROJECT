"use client";

import React, { useState } from "react";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import { selectQueue } from "@/features/alerts/selectors";
import { StreamTile } from "@/features/wall/StreamTile";
import { VideoUploadDetection } from "@/features/upload/VideoUploadDetection";
import { AlertDrawer } from "@/features/alerts/AlertDrawer";
import { CameraStream, Alert } from "@/lib/types";
import {
  RadioTower,
  LayoutGrid,
  Bell,
  ChevronRight,
  Flame,
  AlertTriangle,
  Info,
  CheckCircle2,
  Camera,
  Film,
  Layers,
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

import { motion } from "framer-motion";

type DetectionMode = "live" | "upload";
type LayoutPreset = "2x2" | "3x3" | "4x4";
type AlertFilter = "all" | "critical" | "warning" | "info";

// ── Compact Alert Queue Card (Forge System) ──────────────────────────
function AlertQueueCard({
  alert,
  onInspect,
}: {
  alert: Alert;
  onInspect: (id: string) => void;
}) {
  const isCritical = alert.severity === "CRITICAL";
  const isWarning = alert.severity === "WARNING";

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
  let title = "";
  if (alertTypeStr === "fire" || alertTypeStr === "smoke") {
    title = `Fire & Thermal Hazard — ${alert.sector}`;
  } else if (alertTypeStr === "missing_ppe") {
    const itemNames = alert.items.map((i: string) => {
      const raw = i.replace("no_", "").replace(/_/g, " ").toLowerCase();
      if (raw.includes("hardhat") || raw.includes("helmet")) return "Hardhat";
      if (raw.includes("vest")) return "High-Vis Vest";
      if (raw.includes("gloves")) return "Thermal Gloves font-medium";
      if (raw.includes("boots")) return "Safety Boots";
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    });
    title = `Missing ${itemNames.join(" & ")} — ${alert.sector}`;
  } else if (alertTypeStr === "smoking") {
    title = `Restricted Ignition Breach — ${alert.sector}`;
  } else {
    title = `${alertTypeStr.replace(/_/g, " ")} — ${alert.sector}`;
  }

  const desc = isCritical
    ? `Thermal smoke density verified (confidence ${(alert.confidence * 100).toFixed(0)}%)`
    : isWarning
    ? `PPE compliance boundary violation in ${alert.sector}`
    : `System telemetry log`;

  const SevIcon = isCritical ? Flame : isWarning ? AlertTriangle : Info;

  return (
    <button
      type="button"
      onClick={() => onInspect(alert.id)}
      className={`w-full text-left flex gap-0 rounded-sm overflow-hidden border transition-colors hover:border-copper hover:bg-elevated group ${
        isCritical && alert.status === "open"
          ? "border-critical bg-critical-bg animate-critical-pulse"
          : "border-border bg-surface"
      }`}
    >
      {/* 3px Solid Severity Accent Bar */}
      <div
        className={`w-[3px] shrink-0 ${
          isCritical ? "bg-critical" : isWarning ? "bg-warning" : "bg-safe"
        }`}
      />

      {/* Card Content */}
      <div className="flex-1 px-3 py-2 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`flex items-center gap-1 text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded-sm border ${
                isCritical
                  ? "bg-critical text-text-primary border-critical"
                  : isWarning
                  ? "bg-warning text-base border-warning font-semibold"
                  : "bg-safe text-text-primary border-safe"
              }`}
            >
              <SevIcon className="w-2.5 h-2.5" />
              {alert.severity}
            </span>
          </div>
          <span className="text-[9px] font-mono text-text-secondary whitespace-nowrap">
            {timeFormatted} · {timeAgo}
          </span>
        </div>

        <div className="text-xs font-bold font-display text-text-primary leading-tight mb-1 truncate">
          {title}
        </div>

        <div className="flex items-center gap-1 text-[9px] font-mono text-text-secondary mb-1">
          <Camera className="w-2.5 h-2.5 text-copper" />
          <span>{alert.cameraId.toUpperCase().replace("CAM-", "CAM ")}</span>
          <span className="text-border">·</span>
          <span>{alert.sector}</span>
        </div>

        <div className="text-[10px] text-text-secondary font-mono leading-tight truncate">
          {desc}
        </div>
      </div>

      <div className="flex items-center pr-2 text-text-secondary group-hover:text-copper transition-colors">
        <ChevronRight className="w-4 h-4" />
      </div>
    </button>
  );
}

// ── Main Page ────────────────────────────────────────────────────────
export default function LiveWallPage() {
  const byId = useAlertsStore((s) => s.byId);
  const selectedAlertId = useAlertsStore((s) => s.selectedAlertId);
  const setSelectedAlertId = useAlertsStore((s) => s.setSelectedAlertId);

  // Dual Detection Mode State: Live Camera vs Upload Video
  const [detectionMode, setDetectionMode] = useState<DetectionMode>("live");
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>("2x2");
  const [focusedCamId, setFocusedCamId] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");

  const queue = selectQueue(byId);
  const activeAlerts = queue.filter(
    (a) => (a.status === "open" || a.status === "acknowledged") && a.severity !== "COMPLIANCE"
  );
  const selectedAlert = selectedAlertId ? byId[selectedAlertId] || null : null;

  const criticalAlerts = activeAlerts.filter((a) => a.severity === "CRITICAL");
  const warningAlerts = activeAlerts.filter((a) => a.severity === "WARNING");

  const filteredAlerts =
    alertFilter === "critical"
      ? criticalAlerts
      : alertFilter === "warning"
      ? warningAlerts
      : activeAlerts;

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
    layoutPreset === "4x4"
      ? "grid-cols-4"
      : layoutPreset === "3x3"
      ? "grid-cols-3"
      : "grid-cols-2";

  const gridRowsClass =
    layoutPreset === "4x4"
      ? "grid-rows-4"
      : layoutPreset === "3x3"
      ? "grid-rows-3"
      : "grid-rows-2";

  const tabFilters: { key: AlertFilter; label: string; count: number }[] = [
    { key: "all", label: "ALL", count: activeAlerts.length },
    { key: "critical", label: "CRITICAL", count: criticalAlerts.length },
    { key: "warning", label: "WARNING", count: warningAlerts.length },
  ];

  return (
    <div className="flex h-full overflow-hidden bg-base">
      {/* ═══════════════════════════════════════════════════════════════
          LEFT: Detection Viewport (Live Grid OR Video Upload)
      ═══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-border min-w-0">
        {/* Top Control Bar with Dual-Mode Segmented Control */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0 bg-surface">
          {/* Brand/Mode Title */}
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-bold font-display text-text-primary tracking-tight flex items-center gap-2">
              <RadioTower className="w-4 h-4 text-copper" />
              <span>DETECTION VIEWPORT</span>
            </h1>

            {/* Segmented Control: Live Camera ↔ Upload Video */}
            <div className="flex items-center bg-base border border-border rounded-sm p-0.5 relative">
              <button
                type="button"
                onClick={() => setDetectionMode("live")}
                className={`relative z-10 flex items-center gap-1.5 px-3 py-1 rounded-sm text-2xs font-mono font-semibold transition-colors ${
                  detectionMode === "live" ? "text-base" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {detectionMode === "live" && (
                  <motion.div
                    layoutId="activeWallMode"
                    className="absolute inset-0 bg-copper rounded-sm z-[-1]"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <Layers className="w-3 h-3" />
                <span>LIVE CAMERA FEEDS</span>
              </button>
              <button
                type="button"
                onClick={() => setDetectionMode("upload")}
                className={`relative z-10 flex items-center gap-1.5 px-3 py-1 rounded-sm text-2xs font-mono font-semibold transition-colors ${
                  detectionMode === "upload" ? "text-base" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {detectionMode === "upload" && (
                  <motion.div
                    layoutId="activeWallMode"
                    className="absolute inset-0 bg-copper rounded-sm z-[-1]"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <Film className="w-3 h-3" />
                <span>UPLOAD VIDEO</span>
              </button>
            </div>
          </div>

          {/* Controls for Live Mode */}
          {detectionMode === "live" && (
            <div className="flex items-center gap-2">
              {/* Layout Switcher */}
              <div className="flex items-center gap-0.5 bg-base border border-border rounded-sm p-0.5">
                {(["2x2", "3x3", "4x4"] as LayoutPreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setLayoutPreset(preset);
                      setFocusedCamId(null);
                    }}
                    className={`px-2 py-0.5 rounded-sm text-2xs font-mono transition-colors ${
                      layoutPreset === preset
                        ? "bg-copper text-base font-bold"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Viewport Container */}
        {detectionMode === "upload" ? (
          <VideoUploadDetection />
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden p-2">
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
                      setFocusedCamId(
                        focusedCamId === camera.id ? null : camera.id
                      )
                    }
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          RIGHT: Incident Alert Queue Panel (340px fixed)
      ═══════════════════════════════════════════════════════════════ */}
      <div className="w-[340px] shrink-0 flex flex-col overflow-hidden bg-surface border-l border-border">
        {/* Panel Header */}
        <div className="px-3 pt-3 pb-2 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold font-display text-text-primary flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-copper" />
              <span>INCIDENT QUEUE</span>
              {activeAlerts.length > 0 && (
                <span className="text-[9px] font-mono font-bold bg-critical text-text-primary px-1.5 py-0.5 rounded-sm">
                  {activeAlerts.length}
                </span>
              )}
            </h2>
            <Link
              href="/alerts"
              className="flex items-center gap-0.5 text-2xs font-mono text-copper hover:underline"
            >
              Full Queue <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1">
            {tabFilters.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setAlertFilter(tab.key)}
                className={`flex items-center gap-1 px-1.5 py-1 rounded-sm text-[10px] font-mono transition-colors ${
                  alertFilter === tab.key
                    ? "bg-elevated text-text-primary border border-border font-bold"
                    : "text-text-secondary hover:text-text-primary border border-transparent"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1 rounded-sm text-[9px] ${
                    alertFilter === tab.key
                      ? "bg-base text-text-primary"
                      : "text-text-secondary"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Alert List */}
        <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-2">
          {filteredAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <CheckCircle2 className="w-7 h-7 text-safe mb-2" />
              <p className="text-xs font-mono text-text-primary">
                All Sectors Nominal
              </p>
              <p className="text-2xs font-mono text-text-secondary mt-0.5">
                No active breaches detected
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
          <div className="px-3 py-2 border-t border-border shrink-0 bg-base text-2xs font-mono text-text-secondary flex items-center justify-between">
            <span className="text-text-primary font-bold">{activeAlerts.length} OPEN INCIDENTS</span>
            <span className="text-critical font-bold">{criticalAlerts.length} CRITICAL</span>
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
