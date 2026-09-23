"use client";

import React, { useState, useRef, use } from "react";
import { Zone, ZonePoint, ZoneKind } from "@/lib/types";
import {
  Square,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  HelpCircle,
  CigaretteOff,
  HardHat,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ cameraId: string }>;
}

export default function ZoneEditorPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const cameraId = resolvedParams.cameraId || "cam-01";

  // Initial demo polygon zones for this camera
  const [zones, setZones] = useState<Zone[]>([
    {
      id: "zone-01",
      cameraId: cameraId,
      name: "Restricted Chemical Buffer",
      kind: "smoking_restricted",
      color: "#E8700A", // Warning
      active: true,
      polygon: [
        { x: 0.15, y: 0.2 },
        { x: 0.45, y: 0.2 },
        { x: 0.5, y: 0.65 },
        { x: 0.1, y: 0.6 },
      ],
    },
    {
      id: "zone-02",
      cameraId: cameraId,
      name: "Mandatory Hard-Hat Perimeter",
      kind: "ppe_required",
      color: "#2E8B57", // Safe
      active: true,
      polygon: [
        { x: 0.55, y: 0.15 },
        { x: 0.9, y: 0.15 },
        { x: 0.92, y: 0.8 },
        { x: 0.52, y: 0.75 },
      ],
    },
  ]);

  const [selectedZoneId, setSelectedZoneId] = useState<string>("zone-01");
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [newPoints, setNewPoints] = useState<ZonePoint[]>([]);
  const [newZoneKind, setNewZoneKind] = useState<ZoneKind>("smoking_restricted");
  const [newZoneName, setNewZoneName] = useState<string>("New Custom Zone");
  const [saveToast, setSaveToast] = useState<boolean>(false);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawing) return;
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setNewPoints([...newPoints, { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) }]);
  };

  const handleFinishDrawing = () => {
    if (newPoints.length < 3) return;

    const newZone: Zone = {
      id: `zone-${Date.now().toString().slice(-4)}`,
      cameraId,
      name: newZoneName,
      kind: newZoneKind,
      color:
        newZoneKind === "smoking_restricted"
          ? "#E8700A"
          : newZoneKind === "ppe_required"
          ? "#2E8B57"
          : newZoneKind === "hazard_high"
          ? "#C1272D"
          : "#4A7A9B",
      active: true,
      polygon: newPoints,
    };

    setZones([...zones, newZone]);
    setSelectedZoneId(newZone.id);
    setIsDrawing(false);
    setNewPoints([]);
  };

  const handleDeleteZone = (id: string) => {
    setZones(zones.filter((z) => z.id !== id));
    if (selectedZoneId === id) {
      setSelectedZoneId(zones[0]?.id || "");
    }
  };

  const handleSaveToEdge = () => {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  const selectedZone = zones.find((z) => z.id === selectedZoneId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/cameras"
              className="text-text-secondary hover:text-text-primary flex items-center gap-1 text-xs font-mono"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Cameras
            </Link>
          </div>
          <h1 className="text-2xl font-bold font-display text-text-primary tracking-tight flex items-center gap-2.5">
            <Square className="w-6 h-6 text-copper" />
            <span>Interactive SVG Zone Editor ({cameraId.toUpperCase()})</span>
          </h1>
          <p className="text-xs text-text-secondary font-mono mt-0.5">
            Define polygon zones invariant to camera resolution (normalized 0.0 - 1.0 coordinates)
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveToEdge}
          className="px-4 py-2 bg-copper hover:bg-copper-hover text-base rounded-sm text-xs font-mono font-bold flex items-center gap-2 shadow transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>Publish Zones to Edge</span>
        </button>
      </div>

      {saveToast && (
        <div className="p-3 bg-safe-bg border border-safe rounded-sm text-xs font-mono text-safe flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>Hot-reloaded zones published to Edge Node over /edge/config endpoint!</span>
        </div>
      )}

      {/* Editor Main Canvas & Sidebar Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive SVG Canvas */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative w-full aspect-video bg-base rounded-sm overflow-hidden border border-border shadow-2xl crt-grid">
            {/* Background Grid & Surveillance Camera View Mock */}
            <div className="absolute inset-0 pointer-events-none opacity-40">
              <div className="w-full h-full flex items-center justify-center font-mono text-xs text-text-secondary">
                [LIVE SURVEILLANCE FEED: {cameraId.toUpperCase()} — CLICK CANVAS TO PLACE POLYGON VERTICES]
              </div>
            </div>

            {/* Interactive SVG Overlay */}
            <svg
              ref={svgRef}
              onClick={handleSvgClick}
              className={`w-full h-full absolute inset-0 ${
                isDrawing ? "cursor-crosshair" : "cursor-default"
              }`}
              viewBox="0 0 1000 600"
              preserveAspectRatio="none"
            >
              {/* Existing Saved Polygon Zones */}
              {zones.map((zone) => {
                const pointsStr = zone.polygon
                  .map((pt) => `${pt.x * 1000},${pt.y * 600}`)
                  .join(" ");
                const isSelected = zone.id === selectedZoneId;

                return (
                  <g key={zone.id}>
                    <polygon
                      points={pointsStr}
                      fill={zone.color}
                      fillOpacity={isSelected ? 0.35 : 0.18}
                      stroke={zone.color}
                      strokeWidth={isSelected ? 3 : 1.5}
                      strokeDasharray={isSelected ? "none" : "6,4"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedZoneId(zone.id);
                      }}
                      className="transition-all hover:fill-opacity-50 cursor-pointer"
                    />
                    {zone.polygon.map((pt, idx) => (
                      <circle
                        key={idx}
                        cx={pt.x * 1000}
                        cy={pt.y * 600}
                        r={isSelected ? 5 : 3}
                        fill="#F3EFE6"
                        stroke={zone.color}
                        strokeWidth={2}
                      />
                    ))}
                  </g>
                );
              })}

              {/* Active Drawing Polygon Preview */}
              {isDrawing && newPoints.length > 0 && (
                <g>
                  <polyline
                    points={newPoints
                      .map((pt) => `${pt.x * 1000},${pt.y * 600}`)
                      .join(" ")}
                    fill="none"
                    stroke="#C1272D"
                    strokeWidth={2}
                    strokeDasharray="4,4"
                  />
                  {newPoints.map((pt, idx) => (
                    <circle
                      key={idx}
                      cx={pt.x * 1000}
                      cy={pt.y * 600}
                      r={5}
                      fill="#C1272D"
                    />
                  ))}
                </g>
              )}
            </svg>

            {/* Drawing Mode Indicator */}
            {isDrawing && (
              <div className="absolute top-3 left-3 bg-critical-bg border border-critical text-critical font-mono text-xs px-3 py-1 rounded-sm shadow animate-pulse">
                DRAWING ACTIVE: Click to add vertices ({newPoints.length} points placed)
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-text-secondary">
            <span>Click vertices sequentially to build boundary. Min 3 points.</span>
            {isDrawing ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawing(false);
                    setNewPoints([]);
                  }}
                  className="px-3 py-1.5 bg-elevated text-text-secondary rounded-sm border border-border hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={newPoints.length < 3}
                  onClick={handleFinishDrawing}
                  className="px-3 py-1.5 bg-safe hover:bg-safe/80 disabled:opacity-40 text-base font-bold rounded-sm transition-colors"
                >
                  Complete Polygon ({newPoints.length})
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsDrawing(true)}
                className="px-3 py-1.5 bg-brand-accent hover:opacity-80 text-white font-bold rounded-sm flex items-center gap-1.5 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Draw New Zone</span>
              </button>
            )}
          </div>
        </div>

        {/* Sidebar Zone Configuration */}
        <div className="space-y-4">
          <div className="p-4 bg-surface border border-border rounded-sm font-mono text-xs space-y-4">
            <h3 className="font-bold text-text-primary uppercase tracking-wider pb-2 border-b border-border">
              Configured Zones on {cameraId.toUpperCase()}
            </h3>

            <div className="space-y-2">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  onClick={() => setSelectedZoneId(zone.id)}
                  className={`p-3 rounded-sm border cursor-pointer transition-all flex items-center justify-between ${
                    selectedZoneId === zone.id
                      ? "bg-elevated border-copper shadow"
                      : "bg-surface border-border hover:border-text-secondary"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-none border border-border"
                      style={{ backgroundColor: zone.color }}
                    />
                    <div>
                      <div className="font-bold text-text-primary">{zone.name}</div>
                      <div className="text-3xs text-text-secondary uppercase">
                        {zone.kind.replace("_", " ")} ({zone.polygon.length} points)
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteZone(zone.id);
                    }}
                    className="text-text-secondary hover:text-critical p-1 transition-colors"
                    title="Delete Zone"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Selected Zone Properties */}
            {selectedZone && (
              <div className="pt-3 border-t border-border space-y-2">
                <div className="text-text-secondary font-bold">Selected Zone Rules:</div>
                <div className="p-2.5 bg-base border border-border rounded-sm text-2xs space-y-1">
                  <div>
                    <span className="text-text-secondary">TYPE: </span>
                    <span className="text-copper font-bold uppercase">{selectedZone.kind}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary">POLYGON POINTS: </span>
                    <span className="text-text-primary">{selectedZone.polygon.length} vertices</span>
                  </div>
                  <div className="text-text-secondary pt-1 mt-1 border-t border-border">
                    {selectedZone.kind === "smoking_restricted" &&
                      "Smoking events trigger supervisor WARNING only when detected inside this polygon boundary."}
                    {selectedZone.kind === "ppe_required" &&
                      "Missing helmet, vest, gloves, or boots enforce active compliance flags in this region."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
