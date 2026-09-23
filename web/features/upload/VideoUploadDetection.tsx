"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Film,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  Flame,
  CheckCircle2,
  FileVideo,
  Clock,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface IncidentPoint {
  timeSec: number;
  timeLabel: string;
  type: "CRITICAL" | "WARNING" | "SAFE";
  title: string;
  description: string;
  confidence: number;
  detections: Array<{
    label: string;
    box: [number, number, number, number]; // x, y, w, h in percentage
    color: string;
  }>;
}

const DEMO_PRESETS: {
  id: string;
  name: string;
  duration: number; // in seconds
  fileSize: string;
  incidents: IncidentPoint[];
}[] = [
  {
    id: "clip-01",
    name: "Corridor_B3_Machinery_Transit.mp4",
    duration: 65,
    fileSize: "14.2 MB",
    incidents: [
      {
        timeSec: 12,
        timeLabel: "00:12",
        type: "WARNING",
        title: "Missing Hardhat in Transit Zone",
        description: "Worker ID #4092 entered overhead crane perimeter without head protection.",
        confidence: 0.94,
        detections: [
          { label: "Person [0.96]", box: [35, 30, 25, 55], color: "#E8700A" },
          { label: "NO_HARDHAT [0.94]", box: [42, 28, 12, 12], color: "#E8700A" },
          { label: "Safety_Vest [0.92]", box: [38, 42, 20, 25], color: "#2E8B57" },
        ],
      },
      {
        timeSec: 38,
        timeLabel: "00:38",
        type: "CRITICAL",
        title: "Smoke Vapor Near Motor Housing",
        description: "Thermal friction plume detected near conveyance axle bearing.",
        confidence: 0.89,
        detections: [
          { label: "SMOKE_PLUME [0.89]", box: [68, 45, 22, 28], color: "#C1272D" },
          { label: "Motor_Base", box: [65, 55, 28, 35], color: "#7A7368" },
        ],
      },
      {
        timeSec: 54,
        timeLabel: "00:54",
        type: "SAFE",
        title: "Safe Clearance Confirmed",
        description: "Shift supervisor escort confirmed zone evacuated.",
        confidence: 0.98,
        detections: [
          { label: "Supervisor [0.98]", box: [20, 32, 24, 52], color: "#2E8B57" },
          { label: "Hardhat_OK [0.97]", box: [26, 29, 12, 10], color: "#2E8B57" },
          { label: "Vest_OK [0.99]", box: [22, 41, 20, 26], color: "#2E8B57" },
        ],
      },
    ],
  },
  {
    id: "clip-02",
    name: "Chemical_Depot_Tank_Inspection.mp4",
    duration: 80,
    fileSize: "21.6 MB",
    incidents: [
      {
        timeSec: 22,
        timeLabel: "00:22",
        type: "WARNING",
        title: "Restricted Smoking / Ignition Breach",
        description: "Hand-to-mouth ignition gesture flagged in Class 1 Div 2 zone.",
        confidence: 0.91,
        detections: [
          { label: "Person [0.95]", box: [40, 25, 28, 60], color: "#E8700A" },
          { label: "SMOKING_GESTURE [0.91]", box: [48, 35, 12, 12], color: "#E8700A" },
        ],
      },
      {
        timeSec: 60,
        timeLabel: "01:00",
        type: "SAFE",
        title: "Perimeter Safe",
        description: "Routine perimeter sweep completed without anomalies.",
        confidence: 0.97,
        detections: [
          { label: "Inspector [0.97]", box: [30, 28, 25, 55], color: "#2E8B57" },
        ],
      },
    ],
  },
];

export const VideoUploadDetection: React.FC = () => {
  const [dragActive, setDragActive] = useState(false);
  const [state, setState] = useState<"idle" | "uploading" | "processing" | "results">("idle");
  const [progress, setProgress] = useState(0);
  const [processedFrame, setProcessedFrame] = useState(0);
  const [totalFrames] = useState(1200);

  const [selectedPreset, setSelectedPreset] = useState(DEMO_PRESETS[0]);
  const [currentTimeSec, setCurrentTimeSec] = useState(12);
  const [isPlaying, setIsPlaying] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Find the incident matching or closest to the current timestamp
  const activeIncident =
    selectedPreset.incidents.find((inc) => Math.abs(inc.timeSec - currentTimeSec) <= 4) ||
    selectedPreset.incidents[0];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    startUploadFlow();
  };

  const startUploadFlow = () => {
    setState("uploading");
    setProgress(0);
    const uploadInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(uploadInterval);
          startProcessingFlow();
          return 100;
        }
        return prev + 25;
      });
    }, 180);
  };

  const startProcessingFlow = () => {
    setState("processing");
    setProcessedFrame(0);
    const processInterval = setInterval(() => {
      setProcessedFrame((prev) => {
        if (prev >= totalFrames) {
          clearInterval(processInterval);
          setState("results");
          setCurrentTimeSec(selectedPreset.incidents[0].timeSec);
          return totalFrames;
        }
        return prev + 240;
      });
    }, 150);
  };

  // Playback timer when in results mode
  useEffect(() => {
    if (!isPlaying || state !== "results") return;
    const timer = setInterval(() => {
      setCurrentTimeSec((prev) => {
        if (prev >= selectedPreset.duration) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, 500);
    return () => clearInterval(timer);
  }, [isPlaying, state, selectedPreset.duration]);

  // Render the surveillance canvas frame with bounding boxes
  useEffect(() => {
    if (state !== "results") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Dark industrial surveillance plate
    ctx.fillStyle = "#16140F";
    ctx.fillRect(0, 0, W, H);

    // Floor perspective lines
    ctx.strokeStyle = "rgba(58, 51, 42, 0.4)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(W / 2 + (x - W / 2) * 0.1, H * 0.35);
      ctx.stroke();
    }

    // Heavy machine geometry in background
    ctx.fillStyle = "#211D17";
    ctx.fillRect(W * 0.05, H * 0.25, W * 0.22, H * 0.6);
    ctx.fillStyle = "#2C2620";
    ctx.fillRect(W * 0.72, H * 0.2, W * 0.24, H * 0.65);

    // Hazard stripes on equipment
    ctx.strokeStyle = "rgba(198, 117, 43, 0.3)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(W * 0.06 + i * 12, H * 0.8);
      ctx.lineTo(W * 0.06 + i * 12 + 8, H * 0.82);
      ctx.stroke();
    }

    // Draw active detections from activeIncident
    if (activeIncident && activeIncident.detections) {
      activeIncident.detections.forEach((det) => {
        const x = (det.box[0] / 100) * W;
        const y = (det.box[1] / 100) * H;
        const w = (det.box[2] / 100) * W;
        const h = (det.box[3] / 100) * H;

        ctx.strokeStyle = det.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        // Fill tint
        ctx.fillStyle = `${det.color}22`;
        ctx.fillRect(x, y, w, h);

        // Corner tick brackets
        const bLen = 8;
        ctx.strokeStyle = det.color;
        ctx.lineWidth = 3;
        // Top-left
        ctx.beginPath();
        ctx.moveTo(x, y + bLen);
        ctx.lineTo(x, y);
        ctx.lineTo(x + bLen, y);
        ctx.stroke();

        // Label banner
        ctx.fillStyle = det.color;
        ctx.fillRect(x, y - 16, Math.max(w, 80), 16);
        ctx.fillStyle = "#F3EFE6";
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.fillText(det.label, x + 4, y - 4);
      });
    }

    // Timestamp & Camera OSD overlay
    ctx.fillStyle = "rgba(22, 20, 15, 0.85)";
    ctx.fillRect(10, 10, 220, 24);
    ctx.strokeStyle = "#3A332A";
    ctx.strokeRect(10, 10, 220, 24);
    ctx.fillStyle = "#F3EFE6";
    ctx.font = "10px 'JetBrains Mono', monospace";
    const minutes = Math.floor(currentTimeSec / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (currentTimeSec % 60).toString().padStart(2, "0");
    ctx.fillText(
      `OFFLINE INFERENCE · [00:${minutes}:${seconds}]`,
      18,
      26
    );
  }, [state, currentTimeSec, activeIncident]);

  return (
    <div className="flex-1 flex flex-col h-full bg-base text-text-primary overflow-hidden p-4">
      {/* ── Mode Header ── */}
      <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
        <div>
          <h2 className="text-sm font-bold font-display text-text-primary flex items-center gap-2">
            <Film className="w-4 h-4 text-copper" />
            <span>Surveillance Video Offline Analysis</span>
          </h2>
          <p className="text-2xs text-text-secondary font-mono mt-0.5">
            Run YOLO11s ONNX inference against pre-recorded CCTV footage with scrubbable incident timeline.
          </p>
        </div>

        {state === "results" && (
          <button
            onClick={() => {
              setState("idle");
              setIsPlaying(false);
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-2xs font-mono bg-surface hover:bg-elevated border border-border rounded-sm text-text-primary transition-colors"
          >
            <RotateCcw className="w-3 h-3 text-copper" />
            <span>Upload New Footage</span>
          </button>
        )}
      </div>

      {/* ── State 1: IDLE DROP-ZONE ── */}
      {state === "idle" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-0">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={startUploadFlow}
            className={`w-full max-w-2xl border-2 border-dashed rounded-sm p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150 ${
              dragActive
                ? "border-copper bg-copper/10 scale-[1.01]"
                : "border-border bg-surface hover:border-copper/70 hover:bg-elevated/60"
            }`}
          >
            <div className="w-14 h-14 rounded-sm bg-elevated border border-border flex items-center justify-center mb-4">
              <Upload className="w-6 h-6 text-copper" />
            </div>

            <h3 className="text-base font-bold font-display text-text-primary mb-1">
              Drop surveillance footage or click to browse
            </h3>
            <p className="text-xs text-text-secondary font-mono mb-4">
              Direct pipeline to local YOLO11s Stage 2 ONNX edge worker
            </p>

            <div className="flex items-center gap-4 text-2xs font-mono text-telemetry bg-base/80 px-4 py-2 border border-border rounded-sm">
              <span>FORMATS: MP4, MOV, WEBM</span>
              <span>•</span>
              <span>MAX SIZE: 120 MB</span>
              <span>•</span>
              <span>MAX DURATION: 5 MIN</span>
            </div>
          </div>

          {/* Quick Preset Selector for instant demo verification */}
          <div className="w-full max-w-2xl mt-6 pt-5 border-t border-border">
            <div className="text-2xs font-mono text-text-secondary mb-2 flex items-center justify-between">
              <span>OR LOAD A VERIFIED AUDIT DATASET PRESET:</span>
              <span className="text-copper">INSTANT STAGE DEMO</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DEMO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setSelectedPreset(preset);
                    startUploadFlow();
                  }}
                  className="flex items-start gap-3 p-3 text-left bg-surface hover:bg-elevated border border-border hover:border-copper rounded-sm transition-all group"
                >
                  <FileVideo className="w-5 h-5 text-copper shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-mono font-semibold text-text-primary truncate group-hover:text-copper transition-colors">
                      {preset.name}
                    </div>
                    <div className="text-2xs font-mono text-text-secondary mt-0.5">
                      {preset.duration}s duration · {preset.fileSize} · {preset.incidents.length} flagged events
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-secondary group-hover:text-copper self-center" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── State 2: UPLOADING ── */}
      {state === "uploading" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md bg-surface border border-border p-6 rounded-sm text-center">
            <Upload className="w-8 h-8 text-copper mx-auto mb-3 animate-bounce" />
            <h3 className="text-sm font-bold font-display text-text-primary">
              Buffering Surveillance Feed
            </h3>
            <p className="text-2xs text-text-secondary font-mono mt-1 mb-4">
              Ingesting {selectedPreset.name} into memory frame-buffer...
            </p>

            {/* Progress Bar (Signal Copper) */}
            <div className="w-full bg-base border border-border h-2 rounded-sm overflow-hidden mb-2">
              <div
                className="bg-copper h-full transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-2xs font-mono text-copper text-right">
              {progress}% COMPLETED
            </div>
          </div>
        </div>
      )}

      {/* ── State 3: PROCESSING INFERENCE ── */}
      {state === "processing" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md bg-surface border border-border p-6 rounded-sm text-center">
            <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-copper border-t-transparent animate-spin" />
            <h3 className="text-sm font-bold font-display text-text-primary">
              Executing YOLO11s ONNX Edge Inference
            </h3>
            <p className="text-2xs text-text-secondary font-mono mt-1 mb-4">
              Temporal voting engine running (Fire 2/5 · PPE 8/10)...
            </p>

            <div className="w-full bg-base border border-border h-2 rounded-sm overflow-hidden mb-2">
              <div
                className="bg-copper h-full transition-all duration-100"
                style={{ width: `${(processedFrame / totalFrames) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-2xs font-mono text-text-secondary">
              <span className="text-slate-connect font-semibold">48.2 FPS (ONNX INT8)</span>
              <span className="text-copper">
                Frame {processedFrame} / {totalFrames}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── State 4: RESULTS WITH SCRUBBABLE TIMELINE ── */}
      {state === "results" && (
        <div className="flex-1 flex flex-col min-h-0 pt-3 gap-3 overflow-hidden">
          {/* Main Video Detection Frame + Inspector Column */}
          <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-hidden">
            {/* Left: Video / Canvas Player */}
            <div className="flex-1 relative bg-base border border-border rounded-sm overflow-hidden flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={800}
                height={450}
                className="w-full h-full object-contain"
              />

              {/* HUD Corner Brackets */}
              <div className="hud-bracket top-left" />
              <div className="hud-bracket top-right" />
              <div className="hud-bracket bottom-left" />
              <div className="hud-bracket bottom-right" />
            </div>

            {/* Right: Active Frame Triage Inspector */}
            <div className="w-full lg:w-80 bg-surface border border-border rounded-sm p-3 flex flex-col shrink-0 overflow-y-auto">
              <div className="text-2xs font-mono text-text-secondary border-b border-border pb-2 mb-3 flex items-center justify-between">
                <span>ACTIVE FRAME TELEMETRY</span>
                <span className="text-copper font-bold">
                  {Math.floor(currentTimeSec / 60).toString().padStart(2, "0")}:
                  {(currentTimeSec % 60).toString().padStart(2, "0")}
                </span>
              </div>

              {/* Severity Banner */}
              <div
                className={`p-2.5 rounded-sm border mb-3 ${
                  activeIncident.type === "CRITICAL"
                    ? "bg-critical-bg border-critical text-critical"
                    : activeIncident.type === "WARNING"
                    ? "bg-warning-bg border-warning text-warning"
                    : "bg-safe-bg border-safe text-safe"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase mb-1">
                  {activeIncident.type === "CRITICAL" && <Flame className="w-3.5 h-3.5" />}
                  {activeIncident.type === "WARNING" && <AlertTriangle className="w-3.5 h-3.5" />}
                  {activeIncident.type === "SAFE" && <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{activeIncident.type} EVENT DETECTED</span>
                </div>
                <div className="text-xs font-bold font-display text-text-primary">
                  {activeIncident.title}
                </div>
                <div className="text-2xs font-mono text-text-secondary mt-1">
                  {activeIncident.description}
                </div>
              </div>

              {/* Detected Entities List */}
              <div className="space-y-1.5 flex-1 mb-3">
                <div className="text-2xs font-mono text-text-secondary uppercase">
                  Identified Bounding Tensors:
                </div>
                {activeIncident.detections.map((det, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 bg-base border border-border rounded-sm flex items-center justify-between text-2xs font-mono"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-none"
                        style={{ backgroundColor: det.color }}
                      />
                      <span className="text-text-primary">{det.label}</span>
                    </div>
                    <span className="text-text-secondary">
                      [{det.box.join(",")}]
                    </span>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-border">
                <button
                  onClick={() => alert(`Timestamp ${currentTimeSec}s flagged for safety review`)}
                  className="w-full py-1.5 bg-copper hover:bg-copper-hover text-base text-xs font-mono font-bold rounded-sm transition-colors"
                >
                  LOG INCIDENT & NOTIFY SUPERVISOR
                </button>
              </div>
            </div>
          </div>

          {/* ── Bottom Scrubbable Timeline ── */}
          <div className="h-20 bg-surface border border-border rounded-sm p-2 flex flex-col shrink-0">
            {/* Controls Bar */}
            <div className="flex items-center justify-between text-2xs font-mono text-text-secondary mb-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-1 text-text-primary hover:text-copper transition-colors"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                </button>
                <span>
                  {Math.floor(currentTimeSec / 60).toString().padStart(2, "0")}:
                  {(currentTimeSec % 60).toString().padStart(2, "0")} / 01:05
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-critical inline-block" /> Critical Event
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-warning inline-block" /> Warning Event
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-safe inline-block" /> Safe Interval
                </span>
              </div>
            </div>

            {/* Clickable / Scrubbable Timeline Track */}
            <div
              className="relative w-full h-8 bg-base border border-border rounded-sm cursor-pointer select-none flex items-center overflow-hidden px-1"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                const targetSec = Math.round(ratio * selectedPreset.duration);
                setCurrentTimeSec(targetSec);
              }}
            >
              {/* Green baseline for compliant time */}
              <div className="absolute inset-y-2 left-0 right-0 bg-safe-bg" />

              {/* Severity Incident Markers along timeline */}
              {selectedPreset.incidents.map((inc, i) => {
                const posPercent = (inc.timeSec / selectedPreset.duration) * 100;
                return (
                  <div
                    key={i}
                    style={{ left: `${posPercent}%` }}
                    className={`absolute top-0 bottom-0 w-3 -ml-1.5 flex items-center justify-center group z-10`}
                    title={`${inc.timeLabel} — ${inc.title}`}
                  >
                    <div
                      className={`w-2 h-6 rounded-none ${
                        inc.type === "CRITICAL"
                          ? "bg-critical animate-pulse"
                          : inc.type === "WARNING"
                          ? "bg-warning"
                          : "bg-safe"
                      }`}
                    />
                    {/* Hover marker tooltip */}
                    <div className="absolute bottom-full mb-1.5 hidden group-hover:block px-2 py-1 bg-elevated border border-border rounded-sm text-[10px] font-mono text-text-primary whitespace-nowrap shadow-lg z-20 pointer-events-none">
                      {inc.timeLabel} · {inc.title}
                    </div>
                  </div>
                );
              })}

              {/* Scrubber Playhead (Signal Copper) */}
              <div
                style={{ left: `${(currentTimeSec / selectedPreset.duration) * 100}%` }}
                className="absolute top-0 bottom-0 w-1 bg-copper z-20 pointer-events-none"
              >
                <div className="w-2.5 h-2.5 bg-copper rounded-none -ml-[3px] -top-1 absolute" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
