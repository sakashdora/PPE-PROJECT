"use client";

import React from "react";
import { CameraStream } from "@/lib/types";

interface RadarSweepProps {
  cameras?: CameraStream[];
  size?: number;
  className?: string;
}

export const RadarSweep: React.FC<RadarSweepProps> = ({
  cameras = [],
  size = 260,
  className = "",
}) => {
  const center = size / 2;
  const radius = size / 2 - 16;

  // Pre-mapped camera coordinates on the radar screen
  const cameraBlips = [
    { id: "cam-01", name: "CAM-01", angle: 45, dist: 0.65, sector: "Sector 1 (Loading Bay)", status: "online" },
    { id: "cam-02", name: "CAM-02", angle: 135, dist: 0.78, sector: "Sector 2 (Chemical Storage)", status: "online", critical: false },
    { id: "cam-03", name: "CAM-03", angle: 225, dist: 0.55, sector: "Sector 3 (Assembly)", status: "online" },
    { id: "cam-04", name: "CAM-04", angle: 315, dist: 0.70, sector: "Sector 4 (Furnace)", status: "online" },
  ];

  return (
    <div className={`relative flex flex-col items-center justify-center p-3 font-mono ${className}`}>
      <div
        className="relative rounded-full bg-base border border-border overflow-hidden"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
          {/* Concentric Range Rings */}
          <circle cx={center} cy={center} r={radius * 0.33} fill="none" stroke="#3A332A" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={center} cy={center} r={radius * 0.66} fill="none" stroke="#3A332A" strokeWidth="1" />
          <circle cx={center} cy={center} r={radius} fill="none" stroke="#3A332A" strokeWidth="1.5" />

          {/* Crosshairs */}
          <line x1={center} y1={center - radius} x2={center} y2={center + radius} stroke="#3A332A" strokeWidth="1" strokeDasharray="4 4" />
          <line x1={center - radius} y1={center} x2={center + radius} y2={center} stroke="#3A332A" strokeWidth="1" strokeDasharray="4 4" />

          {/* Sector Zone Labels */}
          <text x={center + radius * 0.4} y={center - radius * 0.4} fill="#A69C8C" fontSize="8" textAnchor="middle">SEC-1</text>
          <text x={center + radius * 0.4} y={center + radius * 0.5} fill="#A69C8C" fontSize="8" textAnchor="middle">SEC-2</text>
          <text x={center - radius * 0.4} y={center + radius * 0.5} fill="#A69C8C" fontSize="8" textAnchor="middle">SEC-3</text>
          <text x={center - radius * 0.4} y={center - radius * 0.4} fill="#A69C8C" fontSize="8" textAnchor="middle">SEC-4</text>
        </svg>

        {/* Rotating Radar Sweep Gradient Cone (Signal Copper) */}
        <div
          className="absolute inset-0 origin-center animate-radar-sweep pointer-events-none"
          style={{
            background: "conic-gradient(from 0deg, rgba(198, 117, 43, 0.25) 0deg, rgba(198, 117, 43, 0.05) 45deg, transparent 75deg)",
          }}
        />

        {/* Camera Blips (Slate Connect) */}
        {cameraBlips.map((blip) => {
          const rad = (blip.angle * Math.PI) / 180;
          const x = center + radius * blip.dist * Math.cos(rad);
          const y = center + radius * blip.dist * Math.sin(rad);

          return (
            <div
              key={blip.id}
              className="absolute group -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
              style={{ left: x, top: y }}
            >
              <div className="relative flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-none bg-slate-connect animate-ping opacity-60" />
                <span className="absolute w-2 h-2 rounded-none bg-slate-connect border border-border" />
              </div>

              {/* Tooltip on hover */}
              <div className="absolute left-4 top-1/2 -translate-y-1/2 hidden group-hover:flex flex-col bg-elevated border border-border px-2 py-1 rounded-sm shadow-xl whitespace-nowrap text-[10px] pointer-events-none z-20">
                <span className="font-bold text-text-primary">{blip.name}</span>
                <span className="text-text-secondary">{blip.sector}</span>
                <span className="text-slate-connect font-semibold">● 28.5 FPS · Synchronized</span>
              </div>
            </div>
          );
        })}

        {/* Center Reticle Point */}
        <div
          className="absolute w-2 h-2 rounded-none bg-copper -translate-x-1/2 -translate-y-1/2"
          style={{ left: center, top: center }}
        />
      </div>

      <div className="mt-2 text-center">
        <span className="text-[11px] font-bold text-text-primary tracking-wider uppercase font-display">
          Factory Floor Optical Coverage
        </span>
        <div className="text-[9px] text-text-secondary">
          4 Edge Sensors Synchronized · 360° Azimuth Monitored
        </div>
      </div>
    </div>
  );
};
