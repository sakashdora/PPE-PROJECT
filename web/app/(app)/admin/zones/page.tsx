"use client";

import React from "react";
import Link from "next/link";
import { MapPin, Camera, ChevronRight, Square, Sliders } from "lucide-react";

const CAMERAS_WITH_ZONES = [
  { id: "cam-01", name: "Camera 01 (Main Loading)", sector: "Sector 1", zoneCount: 2, status: "Active" },
  { id: "cam-02", name: "Camera 02 (Chemical Storage)", sector: "Sector 2", zoneCount: 3, status: "Active" },
  { id: "cam-03", name: "Camera 03 (Assembly Line)", sector: "Sector 3", zoneCount: 1, status: "Active" },
  { id: "cam-04", name: "Camera 04 (Furnace Hall)", sector: "Sector 4", zoneCount: 2, status: "Active" },
];

export default function ZonesOverviewPage() {
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-bold font-display text-text-primary flex items-center gap-2.5">
          <MapPin className="w-6 h-6 text-copper" />
          <span>Factory Safety Zone Management</span>
        </h1>
        <p className="text-xs text-text-secondary font-mono mt-0.5">
          Select a camera stream feed to edit interactive polygon hazard zones (normalized SVG coordinates)
        </p>
      </div>

      {/* Camera Stream Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CAMERAS_WITH_ZONES.map((cam) => (
          <Link
            key={cam.id}
            href={`/admin/zones/${cam.id}`}
            className="p-5 bg-surface hover:bg-elevated border border-border hover:border-copper rounded-sm flex items-center justify-between transition-all group select-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-sm bg-copper/20 border border-copper flex items-center justify-center text-copper group-hover:scale-105 transition-transform">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-display text-text-primary group-hover:text-copper transition-colors">
                  {cam.name}
                </h3>
                <div className="text-2xs font-mono text-text-secondary mt-0.5">
                  {cam.sector} · {cam.zoneCount} Polygon Zones Configured
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-3xs font-mono px-2 py-0.5 rounded-sm bg-base border border-border text-slate-connect">
                {cam.status}
              </span>
              <ChevronRight className="w-4 h-4 text-text-secondary group-hover:text-copper group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
