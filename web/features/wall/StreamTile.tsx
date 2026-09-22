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
  textColor = "#F3EFE6"
) {
  ctx.save();
  ctx.font = "bold 9px 'JetBrains Mono', monospace";
  const metrics = ctx.measureText(text);
  const padX = 4;
  const bannerH = 15;
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y - bannerH, metrics.width + padX * 2, bannerH);
  ctx.fillStyle = textColor;
  ctx.fillText(text, x + padX, y - 4);
  ctx.restore();
}

/** Draw a box outline with optional fill and corner ticks */
function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  opts: { lineWidth?: number; dash?: number[]; fillAlpha?: number } = {}
) {
  const { lineWidth = 1.5, dash = [], fillAlpha = 0 } = opts;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  if (dash.length) ctx.setLineDash(dash);
  else ctx.setLineDash([]);

  if (fillAlpha > 0) {
    const r = parseInt(color.slice(1, 3), 16) || 198;
    const g = parseInt(color.slice(3, 5), 16) || 117;
    const b = parseInt(color.slice(5, 7), 16) || 43;
    ctx.fillStyle = `rgba(${r},${g},${b},${fillAlpha})`;
    ctx.fillRect(x, y, w, h);
  }
  ctx.strokeRect(x, y, w, h);

  // Tactical corner ticks
  const tickLen = 6;
  ctx.setLineDash([]);
  ctx.lineWidth = lineWidth + 1;
  // Top Left
  ctx.beginPath();
  ctx.moveTo(x, y + tickLen);
  ctx.lineTo(x, y);
  ctx.lineTo(x + tickLen, y);
  ctx.stroke();
  // Bottom Right
  ctx.beginPath();
  ctx.moveTo(x + w, y + h - tickLen);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w - tickLen, y + h);
  ctx.stroke();

  ctx.restore();
}

/** Render dark factory background with perspective grid and machinery (Forge Palette) */
function renderBackground(ctx: CanvasRenderingContext2D, W: number, H: number, tick: number) {
  // Base carbon background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#16140F");
  bg.addColorStop(1, "#100E0A");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Perspective floor grid (using #3A332A border hairline)
  ctx.strokeStyle = "rgba(58, 51, 42, 0.4)";
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

  // Left machine silhouette (#211D17 surface)
  ctx.fillStyle = "#211D17";
  ctx.fillRect(W * 0.02, H * 0.22, W * 0.18, H * 0.58);
  ctx.fillStyle = "#2C2620";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(W * 0.025 + i * 2, H * 0.25 + i * 8, W * 0.165, H * 0.06);
  }

  // Right machine silhouette
  ctx.fillStyle = "#211D17";
  ctx.fillRect(W * 0.76, H * 0.2, W * 0.22, H * 0.62);

  // Hazard stripes on machine base (Signal Copper / Warning)
  ctx.save();
  ctx.strokeStyle = "rgba(198, 117, 43, 0.35)";
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(W * 0.025 + i * 9, H * 0.78);
    ctx.lineTo(W * 0.025 + i * 9 + 6, H * 0.8);
    ctx.stroke();
  }
  ctx.restore();

  // Subtle Scanline (Signal Copper tint)
  const scanY = (tick * 1.5) % H;
  ctx.strokeStyle = "rgba(198, 117, 43, 0.08)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, scanY);
  ctx.lineTo(W, scanY);
  ctx.stroke();

  // REC dot (blinks every 25 ticks, Deep Jade for recording)
  if (Math.floor(tick / 25) % 2 === 0) {
    ctx.fillStyle = "#1B8A5A";
    ctx.beginPath();
    ctx.arc(W - 14, 14, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(243, 239, 230, 0.4)";
  ctx.font = "8px 'JetBrains Mono', monospace";
  ctx.fillText("REC", W - 10, 14);
}

export const StreamTile: React.FC<StreamTileProps> = ({
  camera,
  alerts,
  onSelectAlert,
  isExpanded,
  onToggleExpand,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasMJPEG, setHasMJPEG] = useState(false);

  const activeAlert = alerts.find(
    (a) => a.status === "open" || a.status === "acknowledged"
  );
  const isCritical = activeAlert?.severity === "CRITICAL";
  const hasMissingHelmet =
    activeAlert?.type === "missing_ppe" &&
    activeAlert.items.some((i) => i.includes("helmet") || i.includes("hardhat"));
  const isViolation = !!activeAlert;
  const conf = activeAlert ? Math.round(activeAlert.confidence * 100) : 94;

  // Poll MJPEG stream if explicitly enabled
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_MJPEG !== "true") return;
    let attempts = 0;
    const checkLiveStream = async () => {
      try {
        const res = await fetch("http://localhost:8080/health", {
          signal: AbortSignal.timeout(1000),
        });
        if (res.ok) setHasMJPEG(true);
      } catch {
        attempts++;
        if (attempts >= 2) return;
      }
    };
    checkLiveStream();
  }, []);

  // Canvas drawing simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let tick = 0;

    const render = () => {
      tick++;
      const W = canvas.width;
      const H = canvas.height;

      renderBackground(ctx, W, H, tick);

      if (isCritical) {
        // CRITICAL: Fire/Smoke detection
        const px = W * 0.4 + Math.sin(tick * 0.05) * 6;
        const py = H * 0.28 + Math.cos(tick * 0.03) * 4;
        const pw = W * 0.32;
        const ph = H * 0.46;

        drawBox(ctx, px, py, pw, ph, "#C1272D", {
          lineWidth: 2,
          fillAlpha: 0.12,
        });
        drawLabel(
          ctx,
          `FLAME/SMOKE  ${conf}%  [P0-CRIT]`,
          px,
          py,
          "#C1272D",
          "#F3EFE6"
        );

        // Render smoke/fire particles (Matte Safety Red + Safety Orange)
        for (let i = 0; i < 9; i++) {
          const fx = W * 0.46 + Math.sin(tick * 0.09 + i * 0.8) * 28 + i * 14;
          const fy = H * 0.58 - Math.abs(Math.sin(tick * 0.14 + i * 0.65)) * 32 - i * 4;
          const fr = 2.5 + Math.abs(Math.sin(tick * 0.18 + i)) * 3.5;
          ctx.fillStyle = ["#C1272D", "#F2760C", "#681216", "#7E3902"][i % 4];
          ctx.beginPath();
          ctx.arc(fx, fy, fr, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (hasMissingHelmet) {
        // WARNING: Missing Helmet scenario
        const px = W * 0.3;
        const py = H * 0.18;
        const pw = W * 0.2;
        const ph = H * 0.58;

        // Worker bounding box (Warm Neutral / Copper accent)
        drawBox(ctx, px, py, pw, ph, "#7A7368", { lineWidth: 1.5, fillAlpha: 0.04 });
        drawLabel(ctx, "WORKER_04  0.94", px, py, "#2C2620", "#F3EFE6");

        // Missing Hardhat Region (Safety Orange #F2760C)
        const hx = px + pw * 0.1;
        const hy = py + 2;
        const hw = pw * 0.8;
        const hh = ph * 0.22;
        drawBox(ctx, hx, hy, hw, hh, "#F2760C", {
          lineWidth: 1.5,
          dash: [3, 2],
          fillAlpha: 0.16,
        });
        drawLabel(ctx, `NO HELMET  ${conf}%`, hx, hy, "#F2760C", "#F3EFE6");

        // Second worker — compliant
        const p2x = W * 0.56;
        const p2y = H * 0.22;
        const p2w = W * 0.18;
        const p2h = H * 0.5;
        drawBox(ctx, p2x, p2y, p2w, p2h, "#7A7368", { lineWidth: 1.5, fillAlpha: 0.04 });
        drawLabel(ctx, "WORKER_07  0.92", p2x, p2y, "#2C2620", "#F3EFE6");
        drawLabel(ctx, "HARDHAT ✓  0.91", p2x + 2, p2y + 18, "#3E8E5A", "#F3EFE6");
      } else {
        // COMPLIANT: Full PPE pass
        const w1x = W * 0.28;
        const w1y = H * 0.18;
        const w1w = W * 0.19;
        const w1h = H * 0.56;
        drawBox(ctx, w1x, w1y, w1w, w1h, "#7A7368", { lineWidth: 1.5, fillAlpha: 0.04 });
        drawLabel(ctx, "WORKER_01  0.96", w1x, w1y, "#2C2620", "#F3EFE6");
        drawLabel(ctx, "HELMET ✓", w1x + 2, w1y + 18, "#3E8E5A", "#F3EFE6");
        drawLabel(ctx, "VEST ✓", w1x + 2, w1y + 34, "#3E8E5A", "#F3EFE6");

        const w2x = W * 0.56;
        const w2y = H * 0.22;
        const w2w = W * 0.18;
        const w2h = H * 0.5;
        drawBox(ctx, w2x, w2y, w2w, w2h, "#7A7368", { lineWidth: 1.5, fillAlpha: 0.04 });
        drawLabel(ctx, "WORKER_03  0.93", w2x, w2y, "#2C2620", "#F3EFE6");
        drawLabel(ctx, "HARDHAT ✓", w2x + 2, w2y + 18, "#3E8E5A", "#F3EFE6");
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [camera.id, isCritical, hasMissingHelmet, conf]);

  return (
    <div
      className={`relative flex flex-col rounded-sm overflow-hidden bg-surface border transition-colors duration-100 ${
        isCritical
          ? "border-critical border-[2px] animate-critical-pulse"
          : isViolation
          ? "border-warning"
          : "border-border"
      }`}
    >
      {/* HUD Corner Brackets */}
      <div className="hud-bracket top-left" />
      <div className="hud-bracket top-right" />
      <div className="hud-bracket bottom-left" />
      <div className="hud-bracket bottom-right" />

      {/* Top Stream Header */}
      <div className="absolute inset-x-0 top-0 z-20 px-2.5 py-1.5 flex items-center justify-between border-b border-border bg-surface/90">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-text-primary font-mono tracking-wide leading-none">
            {camera.name.toUpperCase()}
          </span>
          <span className="text-[9px] font-mono text-text-secondary bg-elevated px-1.5 py-0.5 rounded-sm border border-border">
            {camera.sector.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 bg-jade/20 border border-jade px-1.5 py-0.5 rounded-sm text-[9px] font-mono font-bold text-jade">
            <span className="w-1.5 h-1.5 rounded-none bg-jade" />
            LIVE
          </span>
          <span className="hidden sm:flex items-center gap-1 text-[9px] font-mono text-text-secondary bg-elevated px-1.5 py-0.5 rounded-sm border border-border">
            <RadioTower className="w-2.5 h-2.5 text-copper" />
            {camera.fps.toFixed(1)} FPS
            <span className="text-border">·</span>
            <span className={camera.latencyMs < 40 ? "text-safe" : "text-warning"}>
              {camera.latencyMs}ms
            </span>
          </span>
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1 text-text-secondary hover:text-text-primary rounded-sm bg-elevated border border-border transition-colors"
            >
              {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Surveillance Video Feed / Canvas */}
      <div className="relative flex-1 bg-base min-h-0">
        {hasMJPEG ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`http://localhost:8080/stream?cam=${camera.id}`}
            alt={camera.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={640}
            height={360}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Bottom Status Ticker */}
      <div className="px-2.5 py-1.5 bg-surface border-t border-border flex items-center justify-between text-[10px] font-mono">
        <div className="flex items-center gap-1.5 truncate">
          <span
            className={`w-1.5 h-1.5 rounded-none ${
              isCritical
                ? "bg-critical animate-pulse"
                : isViolation
                ? "bg-warning"
                : "bg-safe"
            }`}
          />
          <span className="text-text-secondary truncate">
            {isCritical
              ? "FIRE HAZARD ACTIVE — CAS LATCHED"
              : hasMissingHelmet
              ? "PPE VIOLATION: HELMET BREACH"
              : activeAlert
              ? `HAZARD: ${activeAlert.items[0]?.toUpperCase()}`
              : "ZONE NOMINAL — FULL COMPLIANCE"}
          </span>
        </div>

        {activeAlert && onSelectAlert && (
          <button
            type="button"
            onClick={() => onSelectAlert(activeAlert.id)}
            className="text-[9px] font-mono text-copper hover:underline uppercase shrink-0 font-bold ml-2"
          >
            Triage [{conf}%]
          </button>
        )}
      </div>
    </div>
  );
};
