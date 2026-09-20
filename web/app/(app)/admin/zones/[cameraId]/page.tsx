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
      color: "#f59e0b",
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
      color: "#38bdf8",
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
          ? "#f59e0b"
          : newZoneKind === "ppe_required"
          ? "#38bdf8"
          : newZoneKind === "hazard_high"
          ? "#ef4444"
          : "#64748b",
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
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-industrial-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/cameras"
              className="text-slate-400 hover:text-white flex items-center gap-1 text-xs font-mono"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Cameras
            </Link>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Square className="w-6 h-6 text-amber-400" />
            <span>Interactive SVG Zone Editor ({cameraId.toUpperCase()})</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Define polygon zones invariant to camera resolution (normalized 0.0 - 1.0 coordinates)
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveToEdge}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-2 shadow"
        >
          <Save className="w-4 h-4" />
          <span>Publish Zones to Edge Worker</span>
        </button>
      </div>

      {saveToast && (
        <div className="p-3 bg-emerald-950 border border-emerald-600 rounded-lg text-xs font-mono text-emerald-300 flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4" />
          <span>Hot-reloaded zones published to Edge Node over /edge/config endpoint!</span>
        </div>
      )}

      {/* Editor Main Canvas & Sidebar Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive SVG Canvas */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border-2 border-industrial-700 shadow-2xl crt-grid">
            {/* Background Grid & Surveillance Camera View Mock */}
            <div className="absolute inset-0 pointer-events-none opacity-40">
              <div className="w-full h-full flex items-center justify-center font-mono text-xs text-slate-500">
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
                        fill="#ffffff"
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
                    stroke="#ef4444"
                    strokeWidth={2}
                    strokeDasharray="4,4"
                  />
                  {newPoints.map((pt, idx) => (
                    <circle
                      key={idx}
                      cx={pt.x * 1000}
                      cy={pt.y * 600}
                      r={5}
                      fill="#ef4444"
                    />
                  ))}
                </g>
              )}
            </svg>

            {/* Drawing Mode Indicator */}
            {isDrawing && (
              <div className="absolute top-3 left-3 bg-red-600/90 text-white font-mono text-xs px-3 py-1 rounded shadow animate-pulse">
                DRAWING ACTIVE: Click to add vertices ({newPoints.length} points placed)
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Click vertices sequentially to build polygon boundary. Minimum 3 points required.</span>
            {isDrawing ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawing(false);
                    setNewPoints([]);
                  }}
                  className="px-3 py-1 bg-industrial-800 text-slate-300 rounded hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={newPoints.length < 3}
                  onClick={handleFinishDrawing}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded"
                >
                  Complete Polygon ({newPoints.length})
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsDrawing(true)}
                className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Draw New Zone</span>
              </button>
            )}
          </div>
        </div>

        {/* Sidebar Zone Configuration */}
        <div className="space-y-4">
          <div className="p-4 bg-industrial-900 border border-industrial-800 rounded-xl font-mono text-xs space-y-4">
            <h3 className="font-bold text-white uppercase tracking-wider pb-2 border-b border-industrial-800">
              Configured Zones on {cameraId.toUpperCase()}
            </h3>

            <div className="space-y-2">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  onClick={() => setSelectedZoneId(zone.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                    selectedZoneId === zone.id
                      ? "bg-industrial-850 border-white/40 shadow"
                      : "bg-industrial-950 border-industrial-800 hover:border-industrial-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: zone.color }}
                    />
                    <div>
                      <div className="font-bold text-slate-200">{zone.name}</div>
                      <div className="text-3xs text-slate-500 uppercase">
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
                    className="text-slate-500 hover:text-red-400 p-1"
                    title="Delete Zone"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Selected Zone Properties */}
            {selectedZone && (
              <div className="pt-3 border-t border-industrial-800 space-y-2">
                <div className="text-slate-400 font-bold">Selected Zone Rules:</div>
                <div className="p-2.5 bg-black/40 border border-industrial-800 rounded text-2xs space-y-1">
                  <div>
                    <span className="text-slate-500">TYPE: </span>
                    <span className="text-amber-300 font-bold uppercase">{selectedZone.kind}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">POLYGON POINTS: </span>
                    <span className="text-slate-300">{selectedZone.polygon.length} vertices</span>
                  </div>
                  <div className="text-slate-400 pt-1 border-t border-white/5">
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
