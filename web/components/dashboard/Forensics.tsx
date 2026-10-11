"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileVideo,
  Play,
  Trash2,
  Upload,
  X,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Users,
  Eye,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  ChevronRight,
  Maximize2,
} from "lucide-react";
import { Badge, PageHeader } from "./Overview";

export interface WorkerRecord {
  track_id: number;
  first_seen: string;
  last_seen: string;
  first_seen_ts: number;
  last_seen_ts: number;
  helmet: "COMPLIANT" | "VIOLATION" | "UNKNOWN" | string;
  vest: "COMPLIANT" | "VIOLATION" | "UNKNOWN" | string;
  boots?: "COMPLIANT" | "VIOLATION" | "UNKNOWN" | string;
  gloves?: "COMPLIANT" | "VIOLATION" | "UNKNOWN" | string;
  safety_status: "COMPLIANT" | "VIOLATION" | "UNKNOWN" | string;
  confidence: number;
  violations_count: number;
  violations: string[];
  state: "ACTIVE" | "LOST" | "COMPLETED" | string;
  bbox: number[];
  helmet_bbox?: number[] | null;
  vest_bbox?: number[] | null;
  boots_bbox?: number[] | null;
  gloves_bbox?: number[] | null;
  helmet_confidence?: number | null;
  vest_confidence?: number | null;
}

export interface AISafetyResponse {
  id: string;
  type: string;
  severity: "CRITICAL" | "WARNING" | "INFO" | string;
  title: string;
  summary: string;
  protocol: string;
  action_items: string[];
  ts: number;
}

export interface TelemetryFrame {
  ts: number;
  active_tracks: WorkerRecord[];
  all_tracks?: WorkerRecord[];
  hazards?: Array<{ class_name: string; confidence: number; bbox: number[] }>;
  detections?: Array<{ class_id: number; class_name: string; confidence: number; bbox: number[] }>;
  stats?: any;
}

export interface JobAlert {
  event_id?: string;
  track_id?: number;
  class: string;
  desc: string;
  severity: string;
  ts: number;
  confidence?: number;
  snapshot?: string | null;
  ai_response?: AISafetyResponse;
}

export interface Job {
  id: string;
  file: File;
  video_url: string;
  status: "queued" | "uploading" | "analyzing" | "done" | "error";
  progress: number;
  frames: number;
  image: string | null;
  classes: string[];
  error: string;
  report: any;
  alerts: JobAlert[];
  active_tracks: WorkerRecord[];
  all_tracks: WorkerRecord[];
  stats: {
    unique_workers: number;
    active_workers: number;
    compliant_workers: number;
    violation_workers: number;
    unknown_workers: number;
    critical_hazards: number;
  } | null;
  current_ts: number;
  selected_track_id: number | null;
  preview_snapshot: string | null;
  timeline_telemetry: TelemetryFrame[];
  ai_responses: AISafetyResponse[];
  active_ai_response: AISafetyResponse | null;
}

function safeUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function NativeForensicsViewer({
  job,
  selectedTrack,
  activeWorkersCount,
  criticalHazardsCount,
  onResetPreview,
  onSelectSnapshot,
}: {
  job: Job;
  selectedTrack: WorkerRecord | undefined;
  activeWorkersCount: number;
  criticalHazardsCount: number;
  onResetPreview: () => void;
  onSelectSnapshot: (snap: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playbackTime, setPlaybackTime] = useState<number>(0);

  const drawOverlay = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const targetW = Math.max(1, Math.floor(rect.width * dpr));
    const targetH = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const currentTime = video.currentTime;
    setPlaybackTime(currentTime);

    // Find the closest telemetry frame to video.currentTime
    const frames = job.timeline_telemetry;
    let closestFrame: TelemetryFrame | null = null;
    if (frames && frames.length > 0) {
      let minDiff = Infinity;
      for (let i = 0; i < frames.length; i++) {
        const diff = Math.abs(frames[i].ts - currentTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestFrame = frames[i];
        }
      }
      if (minDiff > 1.5 && !video.paused) {
        closestFrame = null;
      }
    }

    // Video display bounds with aspect ratio preservation
    const vw = video.videoWidth || 1920;
    const vh = video.videoHeight || 1080;
    const videoAspect = vw / vh;
    const elementAspect = rect.width / (rect.height || 1);

    let renderW = rect.width;
    let renderH = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (elementAspect > videoAspect) {
      renderW = rect.height * videoAspect;
      offsetX = (rect.width - renderW) / 2;
    } else {
      renderH = rect.width / videoAspect;
      offsetY = (rect.height - renderH) / 2;
    }

    const scaleBox = (b: number[]) => {
      const x1 = offsetX + b[0] * renderW;
      const y1 = offsetY + b[1] * renderH;
      const x2 = offsetX + b[2] * renderW;
      const y2 = offsetY + b[3] * renderH;
      return [x1, y1, Math.max(2, x2 - x1), Math.max(2, y2 - y1)];
    };

    if (closestFrame) {
      // 1. Draw Hazards (fire, smoke)
      if (closestFrame.hazards) {
        for (const hz of closestFrame.hazards) {
          if (!hz.bbox || hz.bbox.length < 4) continue;
          const [hx, hy, hw, hh] = scaleBox(hz.bbox);
          const isFire = hz.class_name === "fire";
          const strokeColor = isFire ? "#ff3d00" : "#ab47bc";
          const fillColor = isFire ? "rgba(255, 61, 0, 0.28)" : "rgba(171, 71, 188, 0.28)";

          ctx.fillStyle = fillColor;
          ctx.fillRect(hx, hy, hw, hh);

          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 3;
          ctx.strokeRect(hx, hy, hw, hh);

          const tag = `[CRITICAL HAZARD] ${hz.class_name.toUpperCase()} (${Math.round((hz.confidence || 0.85) * 100)}%)`;
          ctx.font = "bold 11px Consolas, monospace";
          const tw = ctx.measureText(tag).width;
          ctx.fillStyle = strokeColor;
          ctx.fillRect(hx, Math.max(0, hy - 20), tw + 10, 20);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(tag, hx + 5, Math.max(14, hy - 6));
        }
      }

      // 2. Draw Tracked Workers
      const tracksToDraw = closestFrame.active_tracks || [];
      for (const trk of tracksToDraw) {
        if (!trk.bbox || trk.bbox.length < 4) continue;
        const [px, py, pw, ph] = scaleBox(trk.bbox);
        const isSelected = selectedTrack?.track_id === trk.track_id;

        const isCompliant = trk.safety_status === "COMPLIANT";
        const isViolation = trk.safety_status === "VIOLATION";
        const boxColor = isCompliant ? "#00e676" : (isViolation ? "#ff1744" : "#ffb300");

        // 1. Primary worker box
        ctx.strokeStyle = isSelected ? "#ffaa00" : boxColor;
        ctx.lineWidth = isSelected ? 4 : 2.5;
        if (isSelected) {
          ctx.shadowColor = "#ffaa00";
          ctx.shadowBlur = 12;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.strokeRect(px, py, pw, ph);
        ctx.shadowBlur = 0;

        // 2. Helmet localized bounding box
        if (trk.helmet === "COMPLIANT" && trk.helmet_bbox && trk.helmet_bbox.length >= 4) {
          const [hx, hy, hw, hh] = scaleBox(trk.helmet_bbox);
          ctx.strokeStyle = "#00f078";
          ctx.lineWidth = 2;
          ctx.strokeRect(hx, hy, hw, hh);

          ctx.font = "bold 9px Consolas, monospace";
          const hLbl = "HELMET \u2713";
          const htw = ctx.measureText(hLbl).width + 8;
          const hly = hy - 14 >= 0 ? hy - 14 : hy;
          ctx.fillStyle = "#00f078";
          ctx.fillRect(hx, hly, htw, 14);
          ctx.fillStyle = "#000000";
          ctx.fillText(hLbl, hx + 4, hly + 10);
        }

        // 3. Vest localized bounding box (only when confirmed compliant)
        if (trk.vest === "COMPLIANT" && trk.vest_bbox && trk.vest_bbox.length >= 4) {
          const [vx, vy, vw, vh] = scaleBox(trk.vest_bbox);
          ctx.strokeStyle = "#00d73c";
          ctx.lineWidth = 2;
          ctx.strokeRect(vx, vy, vw, vh);

          ctx.font = "bold 9px Consolas, monospace";
          const vLbl = "VEST \u2713";
          const vtw = ctx.measureText(vLbl).width + 8;
          const vly = vy - 14 >= 0 ? vy - 14 : vy;
          ctx.fillStyle = "#00d73c";
          ctx.fillRect(vx, vly, vtw, 14);
          ctx.fillStyle = "#000000";
          ctx.fillText(vLbl, vx + 4, vly + 10);
        }

        // 4. Header Pill Badge
        const hTag = trk.helmet === "COMPLIANT" ? "HELMET \u2713" : (trk.helmet === "VIOLATION" ? "NO HELMET \u2715" : "HELMET ?");
        const vTag = trk.vest === "COMPLIANT" ? "VEST \u2713" : (trk.vest === "VIOLATION" ? "VEST MISSING \u2715" : "VEST ?");
        let badgeText = `ID #${trk.track_id.toString().padStart(3, "0")} | ${hTag} | ${vTag}`;
        if (trk.boots === "COMPLIANT") badgeText += " | BOOTS \u2713";
        else if (trk.boots === "VIOLATION") badgeText += " | NO BOOTS \u2715";

        ctx.font = "bold 11px Consolas, monospace";
        const badgeWidth = ctx.measureText(badgeText).width + 12;
        const badgeH = 20;
        const badgeY = py - badgeH >= 4 ? py - badgeH : py;

        ctx.fillStyle = boxColor;
        ctx.fillRect(px, badgeY, Math.min(badgeWidth, rect.width - px), badgeH);
        ctx.fillStyle = isViolation ? "#ffffff" : "#000000";
        ctx.fillText(badgeText, px + 6, badgeY + 14);
      }
    }

    ctx.restore();
  };

  useEffect(() => {
    let animId: number;
    const loop = () => {
      drawOverlay();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [job.timeline_telemetry, selectedTrack]);

  // Keep video in sync with latest analysis timestamp if actively analyzing
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (job.status === "analyzing" && job.current_ts > 0) {
      if (Math.abs(video.currentTime - job.current_ts) > 0.8 && video.paused) {
        video.currentTime = job.current_ts;
      }
    }
  }, [job.status, job.current_ts]);

  const snapshotsList = job.report?.snapshots || job.report?.snapshot_frames || [];

  return (
    <div className="video-viewer-panel">
      <div className="video-viewer-header">
        <span>
          <strong>SURVEILLANCE WORKSTATION</strong> · NATIVE VIDEO LIVE TRACK
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {job.preview_snapshot && (
            <button className="button small" onClick={onResetPreview}>
              Return to live video
            </button>
          )}
          <span className="mono" style={{ color: "#eedcc8" }}>
            TIME: {(videoRef.current?.currentTime ?? job.current_ts ?? 0).toFixed(1)}s
          </span>
        </div>
      </div>

      <div className="video-canvas-wrap">
        {job.preview_snapshot ? (
          <>
            <img src={"data:image/jpeg;base64," + job.preview_snapshot} alt="Snapshot evidence preview" />
            <div className="video-hud">
              <span className="video-hud-pill">EVIDENCE SNAPSHOT PREVIEW</span>
              <button
                className="button small"
                style={{ background: "#211c14", border: "1px solid #735939", color: "#e39750" }}
                onClick={onResetPreview}
              >
                Return to Live Video
              </button>
            </div>
          </>
        ) : (
          <>
            <video
              ref={videoRef}
              src={job.video_url}
              controls
              playsInline
              muted
              autoPlay
              loop
              className="forensics-native-video"
            />
            <canvas ref={canvasRef} className="forensics-overlay-canvas" />

            {/* Top HUD */}
            <div className="video-hud">
              <span className="video-hud-pill">
                TRACKING · {playbackTime.toFixed(1)}s · {activeWorkersCount} ACTIVE
              </span>
              {criticalHazardsCount > 0 ? (
                <span
                  className="video-hud-pill"
                  style={{
                    color: "#ff4d4d",
                    background: "rgba(220, 38, 38, 0.40)",
                    border: "1px solid #ff4d4d",
                    fontWeight: 700,
                    textShadow: "0 0 8px rgba(255, 77, 77, 0.6)",
                  }}
                >
                  🔥 {criticalHazardsCount} CRITICAL COMBUSTION EVENTS DETECTED
                </span>
              ) : (
                <span className="video-hud-pill" style={{ color: "#00e676" }}>
                  ACCURATE LIVE TRACK
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Snapshot evidence carousel if available */}
      {snapshotsList.length > 0 && (
        <div style={{ padding: 12, borderTop: "1px solid var(--border)", background: "#17140f" }}>
          <span className="small-text muted" style={{ display: "block", marginBottom: 8 }}>
            EVIDENCE SNAPSHOT CAROUSEL ({snapshotsList.length} captures)
          </span>
          <div className="snapshot-strip">
            {snapshotsList.map((snap: string, i: number) => (
              <img
                key={i}
                src={"data:image/jpeg;base64," + snap}
                alt={`Evidence capture ${i + 1}`}
                style={{
                  cursor: "pointer",
                  border: job.preview_snapshot === snap ? "2px solid #ffaa00" : "1px solid var(--border)",
                }}
                onClick={() => onSelectSnapshot(snap)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AISafetyCopilotPanel({ job }: { job: Job }) {
  const activeAi = job.active_ai_response;
  const allResponses = job.ai_responses || [];
  const [selectedAiId, setSelectedAiId] = useState<string | null>(null);

  const displayedAi = (selectedAiId ? allResponses.find((a) => a.id === selectedAiId) : activeAi) || activeAi;

  const isCritical = displayedAi?.severity === "CRITICAL";
  const isWarning = displayedAi?.severity === "WARNING";
  const panelClass = isCritical ? "critical" : isWarning ? "warning" : "safe";

  return (
    <div className={`ai-copilot-response-panel ${panelClass}`}>
      <div className="ai-response-header">
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          {isCritical ? (
            <Flame size={17} color="#ff3d00" />
          ) : isWarning ? (
            <AlertTriangle size={17} color="#ff9800" />
          ) : (
            <ShieldCheck size={17} color="#4ade80" />
          )}
          <strong>
            {displayedAi ? displayedAi.title : "AI SAFETY COPILOT — LIVE MONITORING ACTIVE"}
          </strong>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {displayedAi && (
            <Badge
              kind={
                displayedAi.severity === "CRITICAL"
                  ? "critical"
                  : displayedAi.severity === "WARNING"
                  ? "warning"
                  : "safe"
              }
            >
              {displayedAi.severity}
            </Badge>
          )}
          <span className="mono" style={{ color: "#d2c7b5", fontSize: 10 }}>
            {displayedAi ? `T: ${displayedAi.ts.toFixed(1)}s` : "STANDBY"}
          </span>
        </div>
      </div>

      <div className="ai-response-body">
        {displayedAi ? (
          <>
            <p style={{ margin: "0 0 10px 0", color: "#f0ece1", fontSize: 13, lineHeight: 1.5 }}>
              {displayedAi.summary}
            </p>
            <div style={{ fontSize: 10, color: "#e58d36", fontFamily: "Consolas, monospace", marginBottom: 10 }}>
              STANDARDS & PROTOCOL: {displayedAi.protocol}
            </div>

            <div className="ai-action-list">
              {displayedAi.action_items?.map((item, idx) => (
                <div key={idx} className="ai-action-item">
                  <span style={{ fontWeight: 700, color: "#e58d36" }}>{idx + 1}.</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {allResponses.length > 1 && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #332b21", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span className="small-text muted">Prior AI Responses ({allResponses.length}):</span>
                {allResponses.slice(0, 6).map((resp) => (
                  <button
                    key={resp.id}
                    className="button small"
                    style={{
                      fontSize: 10,
                      padding: "3px 7px",
                      background: displayedAi.id === resp.id ? "#4a3520" : "#211c14",
                      borderColor: resp.severity === "CRITICAL" ? "#b84037" : "#554332",
                      color: resp.severity === "CRITICAL" ? "#ff8c82" : "#eedcc8",
                    }}
                    onClick={() => setSelectedAiId(resp.id)}
                  >
                    {resp.title.slice(0, 24)}... ({resp.ts.toFixed(1)}s)
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#a69c8c", fontSize: 12 }}>
            <CheckCircle2 size={18} color="#4ade80" />
            <span>
              Real-time inference pipeline calibrated. Upload footage to stream instant detection alerts, OSHA/ISO-standard directives, and automated response actions.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Forensics() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [workerFilter, setWorkerFilter] = useState<"ALL" | "VIOLATION" | "COMPLIANT">("ALL");
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const add = (files: FileList | null) => {
    if (!files || running) return;
    setError("");
    const next: Job[] = [];
    for (const file of Array.from(files)) {
      if (!/\.(mp4|avi|mov|mkv|webm|m4v)$/i.test(file.name)) {
        setError("Choose a supported video file (MP4, AVI, MOV, MKV, WEBM).");
        continue;
      }
      if (file.size > 100 * 1024 * 1024) {
        setError(`Each video must be at most 100 MB (${(file.size / 1048576).toFixed(1)} MB).`);
        continue;
      }
      const video_url = URL.createObjectURL(file);
      next.push({
        id: safeUUID(),
        file,
        video_url,
        status: "queued",
        progress: 0,
        frames: 0,
        image: null,
        classes: [],
        error: "",
        report: null,
        alerts: [],
        active_tracks: [],
        all_tracks: [],
        stats: null,
        current_ts: 0.0,
        selected_track_id: null,
        preview_snapshot: null,
        timeline_telemetry: [],
        ai_responses: [],
        active_ai_response: null,
      });
    }
    setJobs((old) => [...old, ...next].slice(0, 5));
    if (input.current) input.current.value = "";
  };

  const update = (id: string, work: (job: Job) => Job) =>
    setJobs((old) => old.map((j) => (j.id === id ? work(j) : j)));

  const start = async () => {
    setRunning(true);
    setError("");
    const controller = new AbortController();
    abort.current = controller;

    for (const job of jobs.filter((j) => j.status === "queued" || j.status === "error")) {
      if (controller.signal.aborted) break;
      update(job.id, (j) => ({
        ...j,
        status: "uploading",
        error: "",
        report: null,
        alerts: [],
        active_tracks: [],
        all_tracks: [],
        stats: null,
        current_ts: 0.0,
        selected_track_id: null,
        preview_snapshot: null,
        timeline_telemetry: [],
        ai_responses: [],
        active_ai_response: null,
      }));

      let terminal = false;
      try {
        const form = new FormData();
        form.append("files", job.file);
        const token = typeof window !== "undefined" ? localStorage.getItem("argus-token") : null;
        const headers: Record<string, string> = {};
        if (token) headers["authorization"] = `Bearer ${token}`;
        const response = await fetch("/api/forensics", {
          method: "POST",
          headers,
          body: form,
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw Error(body.message || body.detail || "Forensics is unavailable. Check the service connection.");
        }
        if (!response.body) throw Error("The analysis stream was empty.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handleEvent = (line: string) => {
          if (!line.startsWith("data:")) return;
          try {
            const value = JSON.parse(line.slice(5).trim());

            if (value.type === "start") {
              update(job.id, (j) => ({ ...j, status: "analyzing" }));
            }
            if (value.type === "frame") {
              update(job.id, (j) => {
                const incomingActive: WorkerRecord[] = value.active_tracks || [];
                const incomingAll: WorkerRecord[] = value.all_tracks || incomingActive;
                const newTelemetry: TelemetryFrame = {
                  ts: value.ts ?? 0.0,
                  active_tracks: incomingActive,
                  all_tracks: incomingAll,
                  hazards: value.hazards || [],
                  detections: value.detections || [],
                  stats: value.stats || null,
                };

                return {
                  ...j,
                  progress: value.pct,
                  frames: value.frames_done,
                  image: value.snapshot || j.image,
                  classes: value.classes || [],
                  active_tracks: incomingActive,
                  all_tracks: incomingAll,
                  stats: value.stats || j.stats,
                  current_ts: value.ts ?? j.current_ts,
                  timeline_telemetry: [...j.timeline_telemetry, newTelemetry],
                };
              });
            }
            if (value.type === "alert") {
              update(job.id, (j) => {
                const incomingAi = value.ai_response as AISafetyResponse | undefined;
                const nextAiList = incomingAi
                  ? [incomingAi, ...j.ai_responses.filter((a) => a.id !== incomingAi.id)].slice(0, 50)
                  : j.ai_responses;
                return {
                  ...j,
                  alerts: [value, ...j.alerts].slice(0, 100),
                  ai_responses: nextAiList,
                  active_ai_response: incomingAi || j.active_ai_response,
                };
              });
            }
            if (value.type === "ai_response") {
              update(job.id, (j) => {
                const incomingAi = value as AISafetyResponse;
                const nextAiList = [incomingAi, ...j.ai_responses.filter((a) => a.id !== incomingAi.id)].slice(0, 50);
                return {
                  ...j,
                  ai_responses: nextAiList,
                  active_ai_response: incomingAi,
                };
              });
            }
            if (value.type === "done") {
              terminal = true;
              update(job.id, (j) => ({
                ...j,
                status: "done",
                progress: 100,
                frames: value.frames_analyzed,
                report: value,
                all_tracks: value.worker_records || j.all_tracks,
                active_tracks: value.worker_records?.filter((w: WorkerRecord) => w.state === "ACTIVE") || j.active_tracks,
              }));
            }
            if (value.type === "error") {
              terminal = true;
              update(job.id, (j) => ({
                ...j,
                status: "error",
                error: value.msg || "The video could not be analyzed.",
              }));
            }
          } catch {
            // ignore malformed SSE line chunk
          }
        };

        while (true) {
          const chunk = await reader.read();
          buffer += decoder.decode(chunk.value, { stream: !chunk.done });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.trim()) handleEvent(line);
          }
          if (chunk.done) {
            if (buffer.trim()) handleEvent(buffer);
            break;
          }
        }

        if (!terminal) throw Error("Analysis ended before a final result was received.");
      } catch (e) {
        update(job.id, (j) => ({
          ...j,
          status: "error",
          error: controller.signal.aborted ? "Analysis cancelled." : (e as Error).message,
        }));
      }
    }
    setRunning(false);
    abort.current = null;
  };

  const download = (job: Job) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(job.report, null, 2)], { type: "application/json" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = job.file.name + "-forensic-report.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Video Forensics & Safety Tracking"
        description="Inspect uploaded industrial footage with AI-driven worker tracking, person-to-PPE association, and automated safety violation detection."
      >
        {running ? (
          <button className="button danger" onClick={() => abort.current?.abort()}>
            <X size={15} />
            Cancel analysis
          </button>
        ) : (
          <button
            className="button primary"
            disabled={!jobs.some((j) => j.status === "queued" || j.status === "error")}
            onClick={() => void start()}
          >
            <Play size={15} />
            Analyze footage
          </button>
        )}
      </PageHeader>

      <input
        type="file"
        accept=".mp4,.avi,.mov,.mkv,.webm,.m4v"
        multiple
        ref={input}
        onChange={(e) => add(e.target.files)}
        className="sr-only"
        aria-label="Select videos"
      />

      <button
        type="button"
        className="upload-zone wide"
        disabled={running}
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          add(e.dataTransfer.files);
        }}
      >
        <Upload size={32} />
        <h2>Drop surveillance footage here or browse files</h2>
        <p>Supports MP4, MOV, AVI, MKV, WEBM · Up to 5 files · Max 100 MB each</p>
      </button>

      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}

      {jobs.map((job) => {
        const uniqueWorkersCount =
          job.report?.unique_workers ??
          job.stats?.unique_workers ??
          job.all_tracks.length;

        const activeWorkersCount =
          job.stats?.active_workers ??
          job.active_tracks.length;

        const violationWorkersCount =
          job.report?.violation_workers ??
          job.stats?.violation_workers ??
          job.all_tracks.filter((w) => w.safety_status === "VIOLATION").length;

        const compliantWorkersCount =
          job.report?.compliant_workers ??
          job.stats?.compliant_workers ??
          job.all_tracks.filter((w) => w.safety_status === "COMPLIANT").length;

        const criticalHazardsCount =
          job.report?.critical_events ??
          job.stats?.critical_hazards ??
          job.alerts.filter((a) => a.severity === "CRITICAL").length;

        const selectedTrack =
          job.all_tracks.find((t) => t.track_id === job.selected_track_id) ||
          job.active_tracks.find((t) => t.track_id === job.selected_track_id);

        const allTracks = job.all_tracks.length > 0 ? job.all_tracks : job.active_tracks;

        const displayedTracks = allTracks.filter((t) => {
          if (workerFilter === "VIOLATION") return t.safety_status === "VIOLATION";
          if (workerFilter === "COMPLIANT") return t.safety_status === "COMPLIANT";
          return true;
        });

        const activeFrameImage = job.preview_snapshot || job.image;

        return (
          <section className="panel forensics-card" key={job.id} style={{ marginTop: 22 }}>
            {/* Panel Top Heading */}
            <div className="panel-heading">
              <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <FileVideo size={19} color="#e58d36" />
                {job.file.name}
              </h2>
              <div className="panel-tools">
                <Badge
                  kind={
                    job.status === "done"
                      ? "resolved"
                      : job.status === "error"
                      ? "critical"
                      : job.status === "analyzing"
                      ? "compliance"
                      : "acknowledged"
                  }
                >
                  {job.status.toUpperCase()}
                </Badge>
                {job.report && (
                  <button className="button small" onClick={() => download(job)}>
                    <Download size={14} />
                    Export JSON
                  </button>
                )}
                <button
                  className="icon-button"
                  disabled={running}
                  aria-label={"Remove " + job.file.name}
                  onClick={() => setJobs((old) => old.filter((j) => j.id !== job.id))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <div className="panel-content">
              {/* Progress Bar & High-Level Metadata */}
              <div className="progress-track">
                <i style={{ width: job.progress + "%" }} />
              </div>
              <div className="forensics-meta">
                <span>{(job.file.size / 1048576).toFixed(1)} MB</span>
                <span>{job.current_ts > 0 ? `${job.current_ts.toFixed(1)}s tracked` : "Live Tracking..."}</span>
                <span>{uniqueWorkersCount} workers tracked</span>
                <span>{job.progress}% completed</span>
                {job.report && <span>{job.report.processing_time_sec}s total inference</span>}
                <span className="mono" style={{ color: "#d2c7b5" }}>
                  Model: YOLO11s Stage 5
                </span>
              </div>

              {job.error && (
                <div className="error-box" role="alert">
                  {job.error}
                </div>
              )}

              {/* SECTION 9: SAFETY OVERVIEW METRICS CARDS */}
              <div className="summary-grid" style={{ marginBottom: 16 }}>
                <div className="summary-card">
                  <div className="metric-icon">
                    <Users size={22} color="#4ade80" />
                  </div>
                  <div>
                    <span className="muted">Unique Workers</span>
                    <strong>{uniqueWorkersCount}</strong>
                    <div className="small-text muted">Active in frame: {activeWorkersCount}</div>
                  </div>
                </div>

                <div className="summary-card" style={{ borderColor: violationWorkersCount > 0 ? "#772b26" : undefined }}>
                  <div className="metric-icon" style={{ color: "#f87171" }}>
                    <AlertTriangle size={22} color="#f87171" />
                  </div>
                  <div>
                    <span className="muted">Confirmed Violations</span>
                    <strong style={{ color: violationWorkersCount > 0 ? "#ff8c82" : undefined }}>
                      {violationWorkersCount}
                    </strong>
                    <div className="small-text warning-text">
                      {violationWorkersCount > 0 ? "Requires supervisor triage" : "Zero active violations"}
                    </div>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="metric-icon">
                    <CheckCircle2 size={22} color="#34d399" />
                  </div>
                  <div>
                    <span className="muted">Compliant Workers</span>
                    <strong>{compliantWorkersCount}</strong>
                    <div className="small-text safe-text">Full hardhat & PPE verified</div>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="metric-icon">
                    <Flame size={22} color="#fb923c" />
                  </div>
                  <div>
                    <span className="muted">Critical Hazards</span>
                    <strong>{criticalHazardsCount}</strong>
                    <div className="small-text muted">Fire / Smoke combustion events</div>
                  </div>
                </div>
              </div>

              {/* SECTION 8 & 9: WORKSTATION (Left: Video Intelligence Viewer | Right: Live Worker Tracking) */}
              <div className="forensics-workstation">
                {/* LEFT: Video Intelligence Viewer & Real-Time AI Safety Response */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <NativeForensicsViewer
                    job={job}
                    selectedTrack={selectedTrack}
                    activeWorkersCount={activeWorkersCount}
                    criticalHazardsCount={criticalHazardsCount}
                    onResetPreview={() => update(job.id, (j) => ({ ...j, preview_snapshot: null }))}
                    onSelectSnapshot={(snap) =>
                      update(job.id, (j) => ({
                        ...j,
                        preview_snapshot: j.preview_snapshot === snap ? null : snap,
                      }))
                    }
                  />

                  {/* REAL-TIME AI SAFETY COPILOT RESPONSE PANEL */}
                  <AISafetyCopilotPanel job={job} />
                </div>

                {/* RIGHT: Live Worker Tracking Panel (SECTION 7) */}
                <div className="worker-tracking-panel">
                  <div
                    style={{
                      padding: "12px 14px",
                      borderBottom: "1px solid var(--border)",
                      background: "#1e1a14",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                        <Users size={16} color="#e58d36" />
                        Live Worker Tracking Panel
                      </strong>
                      <span className="small-text muted">
                        {displayedTracks.length} workers recorded
                      </span>
                    </div>

                    {/* Filter buttons */}
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        className={"button small " + (workerFilter === "ALL" ? "primary" : "")}
                        onClick={() => setWorkerFilter("ALL")}
                      >
                        All
                      </button>
                      <button
                        className={"button small " + (workerFilter === "VIOLATION" ? "danger" : "")}
                        onClick={() => setWorkerFilter("VIOLATION")}
                      >
                        Violations
                      </button>
                      <button
                        className={"button small " + (workerFilter === "COMPLIANT" ? "primary" : "")}
                        onClick={() => setWorkerFilter("COMPLIANT")}
                      >
                        Safe
                      </button>
                    </div>
                  </div>

                  {/* Worker Cards Scroll List */}
                  <div className="worker-list-scroll">
                    {displayedTracks.length === 0 ? (
                      <div style={{ textAlign: "center", padding: 30, color: "#8a7e6f", fontSize: 12 }}>
                        {allTracks.length === 0 ? "No workers detected in scene (Hazard Area / Unoccupied Zone)" : "No worker tracks match the current filter."}
                      </div>
                    ) : (
                      displayedTracks.map((worker) => {
                        const isSelected = job.selected_track_id === worker.track_id;
                        return (
                          <div
                            key={worker.track_id}
                            className={"worker-card " + (isSelected ? "active-selected" : "")}
                            onClick={() =>
                              update(job.id, (j) => ({
                                ...j,
                                selected_track_id: isSelected ? null : worker.track_id,
                              }))
                            }
                          >
                            <div className="worker-card-head">
                              <span className="worker-id-title">
                                <span
                                  style={{
                                    display: "inline-block",
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background:
                                      worker.safety_status === "COMPLIANT"
                                        ? "#00e676"
                                        : worker.safety_status === "VIOLATION"
                                        ? "#ff5252"
                                        : "#ffa726",
                                  }}
                                />
                                Worker #{worker.track_id.toString().padStart(3, "0")}
                              </span>
                              <Badge
                                kind={
                                  worker.safety_status === "COMPLIANT"
                                    ? "safe"
                                    : worker.safety_status === "VIOLATION"
                                    ? "critical"
                                    : "acknowledged"
                                }
                              >
                                {worker.safety_status}
                              </Badge>
                            </div>

                            <div className="worker-ppe-chips">
                              <span
                                className={
                                  "ppe-chip " +
                                  (worker.helmet === "COMPLIANT"
                                    ? "compliant"
                                    : worker.helmet === "VIOLATION"
                                    ? "violation"
                                    : "unknown")
                                }
                              >
                                🪖 Helmet: {worker.helmet}
                              </span>

                              <span
                                className={
                                  "ppe-chip " +
                                  (worker.vest === "COMPLIANT"
                                    ? "compliant"
                                    : worker.vest === "VIOLATION"
                                    ? "violation"
                                    : "unknown")
                                }
                              >
                                🦺 Vest: {worker.vest === "VIOLATION" ? "VIOLATION (MISSING)" : worker.vest}
                              </span>

                              {worker.boots && (
                                <span
                                  className={
                                    "ppe-chip " +
                                    (worker.boots === "COMPLIANT"
                                      ? "compliant"
                                      : worker.boots === "VIOLATION"
                                      ? "violation"
                                      : "unknown")
                                  }
                                >
                                  🥾 Boots: {worker.boots}
                                </span>
                              )}
                            </div>

                            <div className="worker-meta-row">
                              <span>
                                Interval: {worker.first_seen} → {worker.last_seen}
                              </span>
                              <span>Conf: {(worker.confidence * 100).toFixed(0)}%</span>
                              <span style={{ textTransform: "uppercase" }}>{worker.state}</span>
                            </div>

                            {/* Expanded Interactive Worker Details (Section 7) */}
                            {isSelected && (
                              <div
                                style={{
                                  marginTop: 8,
                                  paddingTop: 8,
                                  borderTop: "1px solid #4d4133",
                                  fontSize: 11,
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 6,
                                  background: "#16130e",
                                  padding: 8,
                                  borderRadius: 4,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                  <span className="muted">Track State:</span>
                                  <span style={{ color: "#eedcc8" }}>{worker.state}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                  <span className="muted">Bounding Box:</span>
                                  <span className="mono" style={{ fontSize: 10 }}>
                                    [{worker.bbox?.map((b) => b.toFixed(2)).join(", ")}]
                                  </span>
                                </div>
                                {worker.violations && worker.violations.length > 0 && (
                                  <div style={{ color: "#ff8c82" }}>
                                    <strong>Violations:</strong>
                                    <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                                      {worker.violations.map((v, idx) => (
                                        <li key={idx}>{v}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                <span className="muted" style={{ fontSize: 10, marginTop: 4 }}>
                                  Highlighted on video player with gold indicator box. Click to unselect.
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 10: SAFETY EVENT TIMELINE */}
              {job.alerts.length > 0 && (
                <div className="panel timeline-panel">
                  <div className="panel-heading">
                    <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <AlertTriangle size={17} color="#e58d36" />
                      Recorded Safety Violations & Hazard Timeline ({job.alerts.length} events)
                    </h2>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Video Time</th>
                          <th>Worker / Target</th>
                          <th>Violation Details</th>
                          <th>Severity</th>
                          <th>Evidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {job.alerts.map((event, i) => (
                          <tr key={i} className="timeline-event-row">
                            <td className="mono" style={{ color: "#f0dfcc" }}>
                              {event.ts?.toFixed(1) || "0.0"}s
                            </td>
                            <td>
                              {event.track_id ? (
                                <button
                                  className="text-button"
                                  onClick={() =>
                                    update(job.id, (j) => ({
                                      ...j,
                                      selected_track_id: event.track_id ?? null,
                                      preview_snapshot: event.snapshot || j.preview_snapshot,
                                    }))
                                  }
                                >
                                  Worker #{event.track_id.toString().padStart(3, "0")}
                                </button>
                              ) : (
                                <span className="muted">Plant Sensor</span>
                              )}
                            </td>
                            <td>{event.desc}</td>
                            <td>
                              <Badge kind={event.severity?.toLowerCase() || "warning"}>
                                {event.severity}
                              </Badge>
                            </td>
                            <td>
                              {event.snapshot ? (
                                <button
                                  className="button small"
                                  onClick={() =>
                                    update(job.id, (j) => ({
                                      ...j,
                                      preview_snapshot: event.snapshot || null,
                                    }))
                                  }
                                >
                                  <Eye size={12} />
                                  View Frame
                                </button>
                              ) : (
                                <span className="muted small-text">No frame</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </>
  );
}
