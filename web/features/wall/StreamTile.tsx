"use client";

import React, { useRef, useEffect, useState } from "react";
import { CameraStream, Alert } from "@/lib/types";
import { Maximize2, Minimize2, RadioTower } from "lucide-react";

interface StreamTileProps {
  camera: CameraStream;
  alerts: Alert[];
  onSelectAlert?: (alertId: string) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

/** Draw a filled label banner above a bounding box */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bgColor: string,
  textColor = "#ffffff"
) {
  ctx.save();
  ctx.font = "bold 10px monospace";
  const metrics = ctx.measureText(text);
  const padX = 5;
  const bannerH = 16;
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y - bannerH, metrics.width + padX * 2, bannerH);
  ctx.fillStyle = textColor;
  ctx.fillText(text, x + padX, y - 4);
  ctx.restore();
}

/** Draw a box outline with optional fill */
function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  opts: { lineWidth?: number; dash?: number[]; fillAlpha?: number } = {}
) {
  const { lineWidth = 2, dash = [], fillAlpha = 0 } = opts;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  if (dash.length) ctx.setLineDash(dash);
  else ctx.setLineDash([]);
  if (fillAlpha > 0) {
    // Parse hex color to rgba
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    ctx.fillStyle = `rgba(${r},${g},${b},${fillAlpha})`;
    ctx.fillRect(x, y, w, h);
  }
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

/** Render the dark factory background with perspective grid and machinery */
function renderBackground(ctx: CanvasRenderingContext2D, W: number, H: number, tick: number) {
  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#07111f");
  bg.addColorStop(1, "#040c19");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Perspective floor grid
  ctx.strokeStyle = "rgba(30, 50, 80, 0.6)";
  ctx.lineWidth = 0.8;
  const vpX = W / 2;
  const vpY = H * 0.38;
  for (let x = 0; x <= W; x += 55) {
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(vpX + (x - vpX) * 0.05, vpY);
    ctx.stroke();
  }
  for (let t = 0; t <= 1; t += 0.14) {
    const y = vpY + (H - vpY) * t;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Left machine silhouette
  ctx.fillStyle = "#0b1930";
  ctx.fillRect(W * 0.02, H * 0.22, W * 0.18, H * 0.58);
  ctx.fillStyle = "#0d1e35";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(W * 0.025 + i * 2, H * 0.25 + i * 8, W * 0.165, H * 0.06);
  }

  // Right machine silhouette
  ctx.fillStyle = "#0b1930";
  ctx.fillRect(W * 0.76, H * 0.2, W * 0.22, H * 0.62);

  // Yellow hazard stripes on machine base
  ctx.save();
  ctx.strokeStyle = "rgba(234, 179, 8, 0.3)";
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(W * 0.025 + i * 9, H * 0.78);
    ctx.lineTo(W * 0.025 + i * 9 + 6, H * 0.8);
    ctx.stroke();
  }
  ctx.restore();

  // Scanline
  const scanY = ((tick * 1.5) % H);
  ctx.strokeStyle = "rgba(56, 189, 248, 0.06)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, scanY);
  ctx.lineTo(W, scanY);
  ctx.stroke();

  // REC dot (blinks every 25 ticks)
  if (Math.floor(tick / 25) % 2 === 0) {
    ctx.fillStyle = "rgba(239, 68, 68, 0.85)";
    ctx.beginPath();
    ctx.arc(W - 14, 14, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.font = "8px monospace";
  ctx.fillText("REC", W - 10, 14);
}

export const StreamTile: React.FC<StreamTileProps> = ({
  camera,
  alerts,
  onSelectAlert,
  isExpanded = false,
  onToggleExpand,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mjpegOnline, setMjpegOnline] = useState(false);

  // Probe MJPEG edge server
  useEffect(() => {
    let alive = true;
    const probe = async () => {
      try {
        const r = await fetch("http://localhost:8080/health", { signal: AbortSignal.timeout(1500) });
        if (r.ok && alive) setMjpegOnline(true);
      } catch {
        if (alive) setMjpegOnline(false);
      }
    };
    probe();
    const t = setInterval(probe, 4000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const activeAlert = alerts.find((a) => a.status === "open" || a.status === "acknowledged");
  const isCritical = activeAlert?.severity === "CRITICAL";
  const hasMissingHelmet =
    activeAlert?.type === "missing_ppe" &&
    activeAlert.items.some((i) => i.includes("helmet") || i === "head");
  const isViolation = !!activeAlert && !isCritical;
  const conf = activeAlert ? (activeAlert.confidence * 100).toFixed(2) : "0.94";

  // ── Canvas renderer ──────────────────────────────────────────────────────────
  useEffect(() => {
    let animId: number;
    let tick = 0;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) { animId = requestAnimationFrame(render); return; }
      const ctx = canvas.getContext("2d");
      if (!ctx) { animId = requestAnimationFrame(render); return; }

      const W = canvas.offsetWidth || canvas.width;
      const H = canvas.offsetHeight || canvas.height;

      // Sync canvas resolution to display size
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }

      tick++;
      renderBackground(ctx, W, H, tick);

      if (isCritical) {
        // ── FIRE / SMOKE scenario ──────────────────────────────────────────
        const pulse = Math.abs(Math.sin(tick * 0.12)) * 5;

        // Orange fire glow bloom
        const glow = ctx.createRadialGradient(W * 0.55, H * 0.65, 5, W * 0.55, H * 0.65, W * 0.3);
        glow.addColorStop(0, `rgba(251,146,60,${0.28 + Math.sin(tick * 0.1) * 0.08})`);
        glow.addColorStop(0.6, `rgba(239,68,68,${0.1})`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        // Fire detection bounding box
        const fx = W * 0.38 + pulse * 0.3;
        const fy = H * 0.3;
        const fw = W * 0.34 + pulse;
        const fh = H * 0.42;
        drawBox(ctx, fx, fy, fw, fh, "#ef4444", { lineWidth: 2.5, fillAlpha: 0.12 });
        drawLabel(ctx, `FIRE  ${conf}%`, fx, fy, "#dc2626");

        // Smoke box
        drawBox(ctx, W * 0.33, H * 0.08, W * 0.3, H * 0.22, "#f97316", { lineWidth: 1.5, dash: [5, 3], fillAlpha: 0.06 });
        drawLabel(ctx, "SMOKE  0.87", W * 0.33, H * 0.08, "#ea580c");

        // Animated flame particles
        for (let i = 0; i < 9; i++) {
          const px = W * 0.42 + Math.sin(tick * 0.09 + i * 0.8) * 28 + i * 18;
          const py = H * 0.58 - Math.abs(Math.sin(tick * 0.14 + i * 0.65)) * 32 - i * 4;
          const pr = 2.5 + Math.abs(Math.sin(tick * 0.18 + i)) * 4;
          const fc = ["#fbbf24", "#f97316", "#ef4444", "#fde68a", "#fb923c"][i % 5];
          ctx.fillStyle = fc;
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();
        }

      } else if (hasMissingHelmet) {
        // ── MISSING HELMET scenario ───────────────────────────────────────
        // Worker person box (blue)
        const px = W * 0.3, py = H * 0.18;
        const pw = W * 0.19, ph = H * 0.58;
        drawBox(ctx, px, py, pw, ph, "#38bdf8", { lineWidth: 2, fillAlpha: 0.04 });
        drawLabel(ctx, "PERSON  0.92", px, py, "#0284c7");

        // Head region — NO HELMET (red dashed)
        const hx = px + pw * 0.08, hy = py + 2;
        const hw = pw * 0.84, hh = ph * 0.23;
        drawBox(ctx, hx, hy, hw, hh, "#ef4444", { lineWidth: 2, dash: [3, 2], fillAlpha: 0.14 });
        drawLabel(ctx, `NO HELMET  ${conf}%`, hx, hy, "#dc2626");

        // Second worker — compliant
        const p2x = W * 0.55, p2y = H * 0.22;
        const p2w = W * 0.17, p2h = H * 0.5;
        drawBox(ctx, p2x, p2y, p2w, p2h, "#10b981", { lineWidth: 1.5, fillAlpha: 0.04 });
        drawLabel(ctx, "PERSON  0.91", p2x, p2y, "#059669");
        drawLabel(ctx, "HARDHAT  0.87", p2x + 2, p2y + 20, "#047857", "#d1fae5");

      } else {
        // ── FULLY COMPLIANT scenario ──────────────────────────────────────
        // Worker 1
        const w1x = W * 0.28, w1y = H * 0.18;
        const w1w = W * 0.18, w1h = H * 0.56;
        drawBox(ctx, w1x, w1y, w1w, w1h, "#10b981", { lineWidth: 1.5, fillAlpha: 0.04 });
        drawLabel(ctx, "PERSON  0.96", w1x, w1y, "#059669");
        drawLabel(ctx, "HELMET ✓", w1x + 2, w1y + 20, "#047857", "#d1fae5");
        drawLabel(ctx, "VEST ✓", w1x + 2, w1y + 40, "#0891b2", "#e0f2fe");

        // Worker 2
        const w2x = W * 0.54, w2y = H * 0.22;
        const w2w = W * 0.17, w2h = H * 0.5;
        drawBox(ctx, w2x, w2y, w2w, w2h, "#10b981", { lineWidth: 1.5, fillAlpha: 0.04 });
        drawLabel(ctx, "PERSON  0.91", w2x, w2y, "#059669");
        drawLabel(ctx, "HARDHAT  0.87", w2x + 2, w2y + 20, "#047857", "#d1fae5");
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [camera.id, isCritical, hasMissingHelmet, conf]);

  // ── Derived state for status display ────────────────────────────────────────
  const borderClass = isCritical
    ? "border-red-500 ring-1 ring-red-500/40 animate-border-alert"
    : isViolation
    ? "border-amber-500/60"
    : "border-industrial-750 hover:border-industrial-600";

  const statusBadge = isCritical
    ? { label: "🔴 CRITICAL", cls: "bg-red-600/90 text-white" }
    : hasMissingHelmet
    ? { label: "⚠ VIOLATION: HELMET", cls: "bg-amber-500/90 text-black font-bold" }
    : activeAlert
    ? { label: `⚠ VIOLATION: ${activeAlert.items[0]?.replace("no_", "").toUpperCase()}`, cls: "bg-amber-500/90 text-black font-bold" }
    : { label: "✓ NORMAL", cls: "bg-emerald-700/80 text-emerald-100" };

  const compBadge = isCritical || activeAlert
    ? { icon: "⚠", cls: "text-amber-400" }
    : { icon: "✓", cls: "text-emerald-400" };

  return (
    <div
      className={`relative flex flex-col rounded-lg overflow-hidden bg-industrial-900 border transition-all duration-300 ${borderClass}`}
    >
      {/* ── Top info overlay ── */}
      <div
        className="absolute inset-x-0 top-0 z-20 px-2.5 py-1.5 flex items-center justify-between"
        style={{ background: "linear-gradient(180deg,rgba(3,9,18,0.95) 0%,rgba(3,9,18,0.55) 60%,transparent 100%)" }}
      >
        {/* Left: cam + sector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-white font-mono tracking-wide leading-none">
            {camera.name}
          </span>
          <span className="text-[9px] font-mono text-slate-400 bg-industrial-800/80 px-1.5 py-0.5 rounded border border-industrial-700/40">
            {camera.sector}
          </span>
        </div>
        {/* Right: LIVE + FPS + latency + expand */}
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 bg-emerald-900/60 border border-emerald-700/50 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
          <span className="hidden sm:flex items-center gap-1 text-[9px] font-mono text-slate-300 bg-black/50 px-1.5 py-0.5 rounded border border-white/5">
            <RadioTower className="w-2.5 h-2.5 text-slate-400" />
            {camera.fps.toFixed(1)} FPS
            <span className="opacity-30">·</span>
            <span className={camera.latencyMs < 40 ? "text-emerald-400" : "text-amber-400"}>
              {camera.latencyMs}ms
            </span>
          </span>
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1 text-slate-400 hover:text-white rounded bg-black/40 hover:bg-black/70 transition-colors"
            >
              {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>

      {/* ── Video / Canvas — fills the tile ── */}
      <div className="flex-1 relative overflow-hidden bg-black min-h-0">
        {mjpegOnline ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`http://localhost:8080/stream/${camera.id}`}
            alt={camera.name}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setMjpegOnline(false)}
          />
        ) : (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
          />
        )}

        {/* Critical fire/smoke overlay at video bottom */}
        {isCritical && activeAlert && (
          <button
            type="button"
            onClick={() => onSelectAlert?.(activeAlert.id)}
            className="absolute bottom-0 inset-x-0 z-20 py-1.5 px-2.5
                       bg-red-600/90 text-white text-[10px] font-bold font-mono
                       flex items-center justify-between animate-pulse"
          >
            <span>🔥 FIRE DETECTED — {camera.sector}</span>
            <span className="text-[9px] bg-black/40 px-2 py-0.5 rounded">INSPECT →</span>
          </button>
        )}
      </div>

      {/* ── Bottom status bar ── */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 px-2.5 py-1.5 flex items-end justify-between pointer-events-none"
        style={{ background: "linear-gradient(0deg,rgba(3,9,18,0.97) 0%,rgba(3,9,18,0.65) 65%,transparent 100%)" }}
      >
        {/* Left: compliance + location */}
        <div className="flex flex-col gap-0.5">
          <span className={`text-[9px] font-bold font-mono flex items-center gap-1 ${compBadge.cls}`}>
            {compBadge.icon} COMPLIANCE
          </span>
          <span className="text-[9px] font-mono text-slate-400 leading-none">
            {camera.id.toUpperCase()} · {camera.location}
          </span>
        </div>

        {/* Right: status badge */}
        <button
          type="button"
          className={`pointer-events-auto text-[9px] font-bold font-mono px-2 py-0.5 rounded ${statusBadge.cls}`}
          onClick={() => activeAlert && onSelectAlert?.(activeAlert.id)}
        >
          {statusBadge.label}
        </button>
      </div>
    </div>
  );
};
