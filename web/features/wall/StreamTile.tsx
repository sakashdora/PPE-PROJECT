"use client";

import React, { useRef, useEffect, useState } from "react";
import { CameraStream, Alert } from "@/lib/types";
import { SeverityBadge } from "@/components/SeverityBadge";
import {
  Flame,
  Maximize2,
  Minimize2,
  VideoOff,
  Radio,
  CheckCircle,
} from "lucide-react";

interface StreamTileProps {
  camera: CameraStream;
  alerts: Alert[];
  onSelectAlert?: (alertId: string) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const StreamTile: React.FC<StreamTileProps> = ({
  camera,
  alerts,
  onSelectAlert,
  isExpanded = false,
  onToggleExpand,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [frameTick, setFrameTick] = useState<number>(0);
  const [mjpegOnline, setMjpegOnline] = useState<boolean>(false);

  // Probe local edge worker MJPEG server on port 8080
  useEffect(() => {
    let isMounted = true;
    const probe = async () => {
      try {
        const res = await fetch("http://localhost:8080/health", { method: "GET", signal: AbortSignal.timeout(1500) });
        if (res.ok && isMounted) setMjpegOnline(true);
      } catch {
        if (isMounted) setMjpegOnline(false);
      }
    };
    probe();
    const timer = setInterval(probe, 4000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const activeAlert = alerts.find(
    (a) => a.status === "open" || a.status === "acknowledged"
  );
  const isCritical = activeAlert?.severity === "CRITICAL";

  // Simulate real-time CCTV frame rendering with dynamic AI bounding boxes
  useEffect(() => {
    let animId: number;
    let tick = 0;

    const renderFrame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      tick++;

      // 1. Dark Factory Floor Background
      ctx.fillStyle = "#0c1322";
      ctx.fillRect(0, 0, w, h);

      // 2. Perspective grid lines simulating factory floor depth
      ctx.strokeStyle = "rgba(30, 41, 59, 0.6)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x * 1.3 - 40, h);
        ctx.stroke();
      }
      for (let y = h * 0.4; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 3. Machinery silhouette
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.fillRect(w * 0.1, h * 0.35, w * 0.25, h * 0.45);
      ctx.fillRect(w * 0.65, h * 0.3, w * 0.28, h * 0.5);

      // Industrial yellow warning stripes on machine base
      ctx.strokeStyle = "rgba(234, 179, 8, 0.3)";
      ctx.lineWidth = 4;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(w * 0.1 + i * 15, h * 0.78);
        ctx.lineTo(w * 0.1 + i * 15 + 10, h * 0.8);
        ctx.stroke();
      }

      // 4. Moving Scanline / Surveillance Camera timestamp
      const scanY = (tick * 1.5) % h;
      ctx.strokeStyle = "rgba(56, 189, 248, 0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(w, scanY);
      ctx.stroke();

      // 5. Draw Dynamic AI Bounding Boxes according to active camera scenario
      if (isCritical) {
        // Draw Flashing Fire Hazard Bounding Box
        const pulse = Math.sin(tick * 0.15) * 4;
        const x = w * 0.42 + pulse;
        const y = h * 0.35;
        const bw = w * 0.28;
        const bh = h * 0.38;

        ctx.strokeStyle = "rgba(239, 68, 68, 0.95)";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, bw, bh);

        ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
        ctx.fillRect(x, y, bw, bh);

        // Flame label banner
        ctx.fillStyle = "#dc2626";
        ctx.fillRect(x, y - 22, 130, 22);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px monospace";
        ctx.fillText("FIRE OUTBREAK 98%", x + 6, y - 6);
      } else if (activeAlert?.type === "missing_ppe" && activeAlert.items.includes("helmet")) {
        // Draw Worker with Bare Head Bounding Box
        const x = w * 0.38;
        const y = h * 0.22;
        const bw = w * 0.22;
        const bh = h * 0.55;

        // Person box
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, bw, bh);

        ctx.fillStyle = "#0284c7";
        ctx.fillRect(x, y - 18, 90, 18);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.fillText("PERSON 94%", x + 4, y - 5);

        // Missing Helmet (bare head) alert sub-box
        ctx.strokeStyle = "#f87171";
        ctx.setLineDash([4, 2]);
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 12, y + 2, bw - 24, bh * 0.26);
        ctx.setLineDash([]);

        ctx.fillStyle = "#ef4444";
        ctx.fillRect(x + 12, y - 2, 85, 14);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px monospace";
        ctx.fillText("NO_HELMET", x + 16, y + 9);
      } else {
        // Normal Safe Person Observation
        const x = w * 0.4;
        const y = h * 0.25;
        const bw = w * 0.2;
        const bh = h * 0.52;

        ctx.strokeStyle = "rgba(16, 185, 129, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, bw, bh);

        ctx.fillStyle = "rgba(16, 185, 129, 0.8)";
        ctx.fillRect(x, y - 16, 85, 16);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px monospace";
        ctx.fillText("COMPLIANT 96%", x + 4, y - 4);
      }

      // Camera Watermark & Timestamp
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "10px monospace";
      ctx.fillText(`${camera.id.toUpperCase()} · ${camera.location}`, 12, h - 12);

      animId = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => cancelAnimationFrame(animId);
  }, [camera, isCritical, activeAlert]);

  return (
    <div
      className={`relative rounded-lg overflow-hidden flex flex-col bg-industrial-900 border transition-all duration-300 ${
        isCritical
          ? "border-red-500 shadow-2xl animate-border-alert ring-2 ring-red-500/50"
          : activeAlert
          ? "border-amber-500/60 shadow-lg"
          : "border-industrial-800 hover:border-industrial-700"
      }`}
    >
      {/* Top Stream Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 px-3 py-2 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              camera.status === "online"
                ? "bg-emerald-500 animate-pulse"
                : "bg-red-500"
            }`}
          />
          <span className="font-bold text-white tracking-wider">
            {camera.name}
          </span>
          <span className="text-3xs text-slate-300 bg-industrial-800/80 px-1.5 py-0.5 rounded border border-industrial-700">
            {camera.sector}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {activeAlert && (
            <button
              type="button"
              onClick={() => onSelectAlert?.(activeAlert.id)}
              className="hover:scale-105 transition-transform"
            >
              <SeverityBadge severity={activeAlert.severity} />
            </button>
          )}

          <div className="hidden sm:flex items-center gap-1.5 text-3xs text-slate-300 bg-black/60 px-2 py-0.5 rounded border border-white/10">
            <Radio className="w-3 h-3 text-emerald-400" />
            <span>{camera.fps.toFixed(1)} FPS</span>
            <span className="opacity-40">|</span>
            <span>{camera.latencyMs}ms</span>
          </div>

          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1 text-slate-400 hover:text-white rounded bg-black/40 hover:bg-black/60 transition-colors"
              title={isExpanded ? "Collapse View" : "Expand View"}
            >
              {isExpanded ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Video Stream Container (Live Edge MJPEG or Simulated Canvas) */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
        {mjpegOnline ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`http://localhost:8080/stream/${camera.id}`}
            alt={camera.name}
            className="w-full h-full object-cover"
            onError={() => setMjpegOnline(false)}
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={640}
            height={360}
            className="w-full h-full object-cover"
          />
        )}

        {/* Critical Alarm Banner Overlay at Bottom of Video */}
        {isCritical && (
          <div className="absolute bottom-2 left-2 right-2 z-20 bg-red-600/90 backdrop-blur text-white px-3 py-1.5 rounded flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2 text-xs font-bold font-mono">
              <Flame className="w-4 h-4 text-yellow-300" />
              <span>CRITICAL: FIRE DETECTED IN SECTOR 2</span>
            </div>
            <button
              type="button"
              onClick={() => onSelectAlert?.(activeAlert.id)}
              className="px-2 py-0.5 bg-black text-white text-3xs rounded font-bold hover:bg-yellow-300 hover:text-black transition-colors uppercase"
            >
              Inspect
            </button>
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="px-3 py-1.5 bg-industrial-950/80 border-t border-industrial-800/80 flex items-center justify-between text-2xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <span>SRC: {camera.sourceType.toUpperCase()}</span>
          <span className="opacity-40">•</span>
          <span>RES: {camera.resolution}</span>
        </div>
        <div>
          {activeAlert ? (
            <span className="text-amber-400 font-semibold">
              VIOLATION: {activeAlert.items.join(", ").toUpperCase()}
            </span>
          ) : (
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> ALL NORMAL
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
