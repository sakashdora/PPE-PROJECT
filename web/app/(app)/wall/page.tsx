"use client";

import React, { useState } from "react";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import { selectQueue } from "@/features/alerts/selectors";
import { StreamTile } from "@/features/wall/StreamTile";
import { AlertCard } from "@/features/alerts/AlertCard";
import { AlertDrawer } from "@/features/alerts/AlertDrawer";
import { CameraStream } from "@/lib/types";
import { DICTIONARY } from "@/lib/i18n";
import {
  Grid2X2,
  Grid3X3,
  Square,
  Flame,
  AlertTriangle,
  Radio,
  Layers,
} from "lucide-react";

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

export default function LiveWallPage() {
  const byId = useAlertsStore((s) => s.byId);
  const selectedAlertId = useAlertsStore((s) => s.selectedAlertId);
  const setSelectedAlertId = useAlertsStore((s) => s.setSelectedAlertId);
  const locale = useAlertsStore((s) => s.locale);
  const t = DICTIONARY[locale];

  const [layoutPreset, setLayoutPreset] = useState<"1x1" | "2x2" | "3x3">("2x2");
  const [focusedCamId, setFocusedCamId] = useState<string | null>(null);

  const queue = selectQueue(byId);
  const activeAlerts = queue.filter((a) => a.status === "open" || a.status === "acknowledged");
  const selectedAlert = selectedAlertId ? byId[selectedAlertId] || null : null;

  // Reorder cameras so any camera with a CRITICAL alert pins to position 0
  const sortedCameras = [...DEMO_CAMERAS].sort((a, b) => {
    const aCrit = Object.values(byId).some(
      (alert) =>
        alert.cameraId === a.id &&
        alert.severity === "CRITICAL" &&
        alert.status === "open"
    );
    const bCrit = Object.values(byId).some(
      (alert) =>
        alert.cameraId === b.id &&
        alert.severity === "CRITICAL" &&
        alert.status === "open"
    );
    if (aCrit && !bCrit) return -1;
    if (!aCrit && bCrit) return 1;
    return a.id.localeCompare(b.id);
  });

  const displayedCameras = focusedCamId
    ? sortedCameras.filter((c) => c.id === focusedCamId)
    : sortedCameras;

  return (
    <div className="space-y-4">
      {/* Top Controls: Live Wall Title, Grid Selector, Summary Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-industrial-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
            <span>{t.liveWall} — Multi-Stream Grid</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Real-time inference wall · 4 edge streams active · Zero cloud latency
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Active Hazard Indicators */}
          {activeAlerts.some((a) => a.severity === "CRITICAL") && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-red-600/90 text-white rounded-md text-xs font-mono font-bold animate-siren-glow">
              <Flame className="w-4 h-4 text-yellow-300" />
              <span>CRITICAL ALARM ACTIVE</span>
            </div>
          )}

          {/* Grid Layout Switcher */}
          <div className="flex items-center gap-1 bg-industrial-900 border border-industrial-800 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setLayoutPreset("1x1");
                setFocusedCamId("cam-01");
              }}
              title="1x1 Focused Stream"
              className={`p-1.5 rounded transition-all ${
                layoutPreset === "1x1"
                  ? "bg-industrial-700 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setLayoutPreset("2x2");
                setFocusedCamId(null);
              }}
              title="2x2 Multi-Stream Wall"
              className={`p-1.5 rounded transition-all ${
                layoutPreset === "2x2"
                  ? "bg-industrial-700 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Grid2X2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setLayoutPreset("3x3");
                setFocusedCamId(null);
              }}
              title="3x3 High Density Wall"
              className={`p-1.5 rounded transition-all ${
                layoutPreset === "3x3"
                  ? "bg-industrial-700 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Video Streams on Left, Compact Alert Feed on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Video Wall Tiles (3 cols on large screens) */}
        <div className="lg:col-span-3">
          <div
            className={`grid gap-4 ${
              layoutPreset === "1x1"
                ? "grid-cols-1"
                : layoutPreset === "2x2"
                ? "grid-cols-1 md:grid-cols-2"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
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
            <div className="mt-3 text-right">
              <button
                type="button"
                onClick={() => setFocusedCamId(null)}
                className="text-xs font-mono text-slate-400 hover:text-white underline"
              >
                ← Return to 4-stream grid
              </button>
            </div>
          )}
        </div>

        {/* Compact Right-Hand Live Alert Queue */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-industrial-900/90 border border-industrial-800 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-industrial-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-white font-mono">
                  {t.openAlerts} ({activeAlerts.length})
                </h3>
              </div>
              <span className="text-3xs font-mono text-slate-400">
                STRICT SEVERITY
              </span>
            </div>

            {/* List of active alerts in strict severity order */}
            <div className="space-y-2 mt-3 max-h-[560px] overflow-y-auto pr-1">
              {activeAlerts.length === 0 ? (
                <div className="p-6 text-center text-slate-500 font-mono text-xs">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-industrial-950 border border-industrial-800 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-slate-600" />
                  </div>
                  Zero active violations in monitored sectors.
                </div>
              ) : (
                activeAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    compact={true}
                    onInspect={(id) => setSelectedAlertId(id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Slide-out Alert Details Drawer */}
      <AlertDrawer
        alert={selectedAlert}
        onClose={() => setSelectedAlertId(null)}
      />
    </div>
  );
}
