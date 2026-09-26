"use client";

import React, { useCallback, useState, useRef, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Video, CheckCircle2, AlertTriangle, Flame, Wind,
  HardHat, ShieldAlert, Cigarette, XCircle, ChevronDown, ChevronRight,
  BarChart2, Clock, Layers, ScanSearch, Trash2, Play, FileVideo,
  Eye, BellRing, Activity, Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Detection { class_name: string; confidence: number; bbox: number[] }

interface FrameEvent {
  type: "frame"; video_id: string; frame_idx: number; ts: number; pct: number;
  frames_done: number; has_critical: boolean; has_violation: boolean;
  classes: string[]; detections: Detection[]; snapshot: string | null;
}
interface AlertEvt {
  type: "alert"; video_id: string; class: string; severity: "CRITICAL" | "WARNING";
  ts: number; confidence: number; desc: string; snapshot: string | null;
}
interface StartEvt {
  type: "start"; video_id: string; filename: string;
  total_frames: number; fps: number; duration_sec: number;
}
interface DoneEvt {
  type: "done"; video_id: string; filename: string; duration_sec: number;
  total_frames: number; frames_analyzed: number; fps: number;
  processing_time_sec: number; compliance_score: number; critical_events: number;
  ppe_violations: number; fire_detections: number; smoke_detections: number;
  smoking_events: number; class_counts: Record<string, number>;
  violations: { type: string; count: number; severity: string; description: string }[];
  snapshot_frames: string[];
  timeline: { frame: number; ts: number; classes: string[]; critical: boolean; violation: boolean }[];
}
interface SSEEvt { type: string; [k: string]: unknown }
interface VideoState {
  id: string; filename: string; status: "queued" | "streaming" | "done" | "error";
  pct: number; liveSnapshot: string | null; liveClasses: string[]; liveTs: number;
  framesDone: number; totalFrames: number; fps: number; duration: number;
  alerts: AlertEvt[]; timeline: DoneEvt["timeline"]; report: DoneEvt | null; error: string | null;
}
interface Toast {
  id: string; severity: "CRITICAL" | "WARNING"; desc: string;
  class_name: string; snapshot: string | null; ts: number; filename: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STREAM_URL = "http://localhost:8090/forensics/stream";
const CRITICAL_CLS  = new Set(["fire", "smoke"]);
const VIOLATION_CLS = new Set(["head", "no_gloves", "no_boots", "cigarette"]);

const classIcon: Record<string, React.ReactNode> = {
  fire:      <Flame       className="w-3.5 h-3.5 text-red-400" />,
  smoke:     <Wind        className="w-3.5 h-3.5 text-orange-300" />,
  head:      <HardHat     className="w-3.5 h-3.5 text-orange-400" />,
  no_gloves: <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />,
  no_boots:  <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />,
  cigarette: <Cigarette   className="w-3.5 h-3.5 text-yellow-400" />,
  helmet:    <HardHat     className="w-3.5 h-3.5 text-green-400" />,
  vest:      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
  gloves:    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
  boots:     <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
  person:    <Eye          className="w-3.5 h-3.5 text-blue-400" />,
};

const sevCls = (s: string) =>
  s === "CRITICAL"
    ? "border-red-800 bg-red-950/60 text-red-300"
    : "border-orange-800 bg-orange-950/60 text-orange-300";

// ─── ComplianceGauge ──────────────────────────────────────────────────────────
function ComplianceGauge({ score }: { score: number }) {
  const color = score >= 80 ? "#2E8B57" : score >= 50 ? "#E8700A" : "#C1272D";
  const dash  = (score / 100) * 264;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="88" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="42" fill="none" stroke="#2C2620" strokeWidth="10" />
        <circle cx="48" cy="48" r="42" fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} 264`} strokeLinecap="round"
          transform="rotate(-90 48 48)" style={{ transition: "stroke-dasharray 0.8s ease" }} />
        <text x="48" y="48" textAnchor="middle" dominantBaseline="central"
          fontSize="18" fontWeight="700" fill={color} fontFamily="JetBrains Mono,monospace">
          {score.toFixed(0)}%
        </text>
      </svg>
      <span className="text-[10px] text-[--text-muted] font-mono">Compliance</span>
    </div>
  );
}

// ─── Timeline bar ─────────────────────────────────────────────────────────────
function TimelineBar({ timeline }: { timeline: DoneEvt["timeline"] }) {
  if (!timeline.length) return null;
  const maxTs = timeline[timeline.length - 1]?.ts || 1;
  return (
    <div>
      <p className="text-[10px] font-mono text-[--text-muted] uppercase tracking-widest mb-1.5">Detection Timeline</p>
      <div className="relative h-7 rounded overflow-hidden bg-[--elevated] border border-[--border]">
        {timeline.map(t => (
          <div key={t.frame}
            title={`${t.ts.toFixed(1)}s: ${t.classes.join(", ")}`}
            className="absolute top-0 bottom-0 w-[2px] opacity-80"
            style={{
              left: `${(t.ts / maxTs * 100).toFixed(2)}%`,
              background: t.critical ? "#C1272D" : t.violation ? "#E8700A" : "#2E8B57",
            }} />
        ))}
        <div className="absolute inset-0 flex items-center px-2 pointer-events-none">
          <span className="text-[9px] font-mono text-[--text-muted]/60">0s</span>
          <span className="ml-auto text-[9px] font-mono text-[--text-muted]/60">{maxTs.toFixed(0)}s</span>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-1">
        {[["#C1272D","Critical"],["#E8700A","Violation"],["#2E8B57","Clean"]].map(([c,l]) => (
          <div key={l} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ background: c }} />
            <span className="text-[10px] font-mono text-[--text-muted]">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Snapshot carousel ────────────────────────────────────────────────────────
function SnapshotCarousel({ frames }: { frames: string[] }) {
  const [idx, setIdx] = useState(0);
  if (!frames.length) return <p className="text-xs text-[--text-muted] py-4 text-center">No annotated frames captured.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded overflow-hidden border border-[--border] bg-black">
        <img src={`data:image/jpeg;base64,${frames[idx]}`} alt={`Frame ${idx+1}`}
          className="w-full object-contain max-h-60" />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
          <span className="text-xs font-mono text-white/60">Frame {idx+1}/{frames.length}</span>
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {frames.map((f,i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={`flex-shrink-0 rounded border-2 overflow-hidden transition-all ${i===idx ? "border-[--brand-accent]" : "border-[--border] opacity-50"}`}>
            <img src={`data:image/jpeg;base64,${f}`} className="w-14 h-9 object-cover" alt="" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── AlertLog ─────────────────────────────────────────────────────────────────
function AlertLog({ alerts }: { alerts: AlertEvt[] }) {
  if (!alerts.length) return <p className="text-xs text-[--text-muted] py-3 text-center">No alerts detected yet.</p>;
  return (
    <div className="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1">
      {[...alerts].reverse().map((a, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
          className={`flex items-start gap-2 px-2.5 py-2 rounded border text-xs ${sevCls(a.severity)}`}>
          <span className="mt-0.5">{classIcon[a.class] || <AlertTriangle className="w-3.5 h-3.5" />}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-semibold">{a.desc}</span>
              <span className={`text-[9px] px-1 py-0.5 rounded-full font-bold ml-auto
                ${a.severity==="CRITICAL" ? "bg-red-700 text-red-100" : "bg-orange-700 text-orange-100"}`}>
                {a.severity}
              </span>
            </div>
            <span className="text-[10px] opacity-70 font-mono">{a.ts.toFixed(1)}s · {(a.confidence*100).toFixed(0)}% conf</span>
          </div>
          {a.snapshot && (
            <img src={`data:image/jpeg;base64,${a.snapshot}`}
              className="w-12 h-8 object-cover rounded border border-white/10 flex-shrink-0" alt="" />
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ─── LiveView ─────────────────────────────────────────────────────────────────
function LiveView({ video }: { video: VideoState }) {
  const hasCrit = video.liveClasses.some(c => CRITICAL_CLS.has(c));
  const hasViol = video.liveClasses.some(c => VIOLATION_CLS.has(c));
  const dotColor = hasCrit ? "bg-red-500" : hasViol ? "bg-orange-500" : "bg-green-500";
  return (
    <div className="relative rounded-xl overflow-hidden border-2 bg-black transition-colors duration-300"
      style={{ borderColor: hasCrit ? "#C1272D" : hasViol ? "#E8700A" : "var(--border)" }}>
      {video.liveSnapshot ? (
        <img src={`data:image/jpeg;base64,${video.liveSnapshot}`}
          alt="Live" className="w-full object-contain max-h-72" />
      ) : (
        <div className="w-full h-48 flex items-center justify-center bg-[--elevated]">
          <Activity className="w-8 h-8 text-[--text-muted] animate-pulse" />
        </div>
      )}
      {/* HUD */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full animate-pulse ${dotColor}`} />
        <span className="text-[10px] font-mono text-white/90 bg-black/60 px-1.5 py-0.5 rounded">
          LIVE · {video.liveTs.toFixed(1)}s
        </span>
      </div>
      <div className="absolute top-2 right-2 text-[10px] font-mono text-white/80 bg-black/60 px-1.5 py-0.5 rounded">
        {video.framesDone} frames · {video.fps}fps
      </div>
      {video.liveClasses.length > 0 && (
        <div className="absolute bottom-6 left-0 right-0 px-3 flex flex-wrap gap-1">
          {video.liveClasses.map(cls => (
            <span key={cls} className={`flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded
              ${CRITICAL_CLS.has(cls) ? "bg-red-900/80 text-red-300"
               : VIOLATION_CLS.has(cls) ? "bg-orange-900/80 text-orange-300"
               : "bg-green-900/60 text-green-300"}`}>
              {classIcon[cls]||null} {cls}
            </span>
          ))}
        </div>
      )}
      {/* Progress */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40">
        <div className={`h-full transition-all duration-200 ${dotColor}`} style={{ width: `${video.pct}%` }} />
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-80 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id}
            initial={{ opacity: 0, x: 40, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.9 }}
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto cursor-pointer rounded-xl border shadow-2xl overflow-hidden
              ${t.severity==="CRITICAL" ? "border-red-700 bg-[#1a0808]" : "border-orange-700 bg-[#1a0e04]"}`}>
            <div className="flex items-start gap-2.5 p-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                ${t.severity==="CRITICAL" ? "bg-red-900/70" : "bg-orange-900/70"}`}>
                {t.severity==="CRITICAL" ? <Zap className="w-4 h-4 text-red-400"/> : <AlertTriangle className="w-4 h-4 text-orange-400"/>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-bold ${t.severity==="CRITICAL" ? "text-red-400" : "text-orange-400"}`}>
                    {t.severity}
                  </span>
                  <span className="text-[10px] text-[--text-muted] font-mono">{t.ts.toFixed(1)}s</span>
                </div>
                <p className="text-sm font-semibold text-[--text-primary] mt-0.5 leading-tight">{t.desc}</p>
                <p className="text-[10px] text-[--text-muted] truncate mt-0.5">{t.filename}</p>
              </div>
              {t.snapshot && (
                <img src={`data:image/jpeg;base64,${t.snapshot}`}
                  className="w-14 h-10 object-cover rounded border border-white/10 flex-shrink-0" alt="" />
              )}
            </div>
            {t.severity==="CRITICAL" && <div className="h-0.5 bg-red-500 animate-pulse" />}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Report card (final) ─────────────────────────────────────────────────────
function ReportCard({ report, alerts }: { report: DoneEvt; alerts: AlertEvt[] }) {
  const [tab, setTab] = useState<"overview"|"frames"|"timeline"|"alerts">("overview");
  const [open, setOpen] = useState(true);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[--border] bg-[--surface] overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[--elevated]/50 transition-colors">
        <FileVideo className="w-4 h-4 text-[--brand-accent] flex-shrink-0" />
        <span className="font-mono text-sm text-[--text-primary] truncate flex-1 text-left">{report.filename}</span>
        <div className="flex items-center gap-2 ml-auto">
          {report.critical_events > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-400 bg-red-950/50 border border-red-900 px-2 py-0.5 rounded-full">
              <Flame className="w-3 h-3" />{report.critical_events}
            </span>
          )}
          {report.ppe_violations > 0 && (
            <span className="flex items-center gap-1 text-xs text-orange-400 bg-orange-950/50 border border-orange-900 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />{report.ppe_violations} PPE
            </span>
          )}
          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded
            ${report.compliance_score>=80?"text-green-400 bg-green-950/40":report.compliance_score>=50?"text-orange-400 bg-orange-950/40":"text-red-400 bg-red-950/40"}`}>
            {report.compliance_score.toFixed(0)}% compliant
          </span>
          {open ? <ChevronDown className="w-4 h-4 text-[--text-muted]" /> : <ChevronRight className="w-4 h-4 text-[--text-muted]" />}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-[--border] px-4 pb-4">
              {/* Meta row */}
              <div className="flex flex-wrap gap-4 py-3 border-b border-[--border-subtle]">
                {[
                  { icon: <Clock className="w-3.5 h-3.5"/>, label:"Duration", val:`${report.duration_sec.toFixed(1)}s` },
                  { icon: <Layers className="w-3.5 h-3.5"/>, label:"Frames", val:`${report.frames_analyzed}/${report.total_frames}` },
                  { icon: <Play className="w-3.5 h-3.5"/>, label:"FPS", val:`${report.fps}` },
                  { icon: <ScanSearch className="w-3.5 h-3.5"/>, label:"Processed in", val:`${report.processing_time_sec}s` },
                ].map(({ icon, label, val }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs">
                    <span className="text-[--text-muted]">{icon}</span>
                    <span className="text-[--text-muted]">{label}:</span>
                    <span className="font-mono text-[--text-primary]">{val}</span>
                  </div>
                ))}
              </div>
              {/* Tabs */}
              <div className="flex gap-1 mt-3 mb-3 border-b border-[--border-subtle]">
                {(["overview","frames","timeline","alerts"] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-3 py-1.5 text-xs font-mono capitalize transition-colors
                      ${tab===t?"text-[--brand-accent] border-b-2 border-[--brand-accent]":"text-[--text-muted] hover:text-[--text-secondary]"}`}>
                    {t}{t==="alerts"&&alerts.length>0?` (${alerts.length})`:""}
                  </button>
                ))}
              </div>
              {tab==="overview" && (
                <div className="flex flex-col md:flex-row gap-6">
                  <ComplianceGauge score={report.compliance_score} />
                  <div className="flex-1 flex flex-col gap-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { label:"Critical Events",  val:report.critical_events,   color:"text-red-400" },
                        { label:"PPE Violations",   val:report.ppe_violations,    color:"text-orange-400" },
                        { label:"Fire Detections",  val:report.fire_detections,   color:"text-red-400" },
                        { label:"Smoke Detections", val:report.smoke_detections,  color:"text-orange-300" },
                        { label:"Smoking Events",   val:report.smoking_events,    color:"text-yellow-400" },
                        { label:"Workers Detected", val:report.class_counts["person"]||0, color:"text-blue-400" },
                      ].map(({ label, val, color }) => (
                        <div key={label} className="rounded bg-[--elevated] border border-[--border] px-3 py-2">
                          <div className={`text-lg font-mono font-bold ${color}`}>{val}</div>
                          <div className="text-[10px] text-[--text-muted] leading-tight">{label}</div>
                        </div>
                      ))}
                    </div>
                    {report.violations.length > 0 ? (
                      <div>
                        <p className="text-[10px] font-mono text-[--text-muted] uppercase tracking-widest mb-1.5">Violations Detected</p>
                        <div className="flex flex-col gap-1">
                          {report.violations.map(v => (
                            <div key={v.type} className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs ${sevCls(v.severity)}`}>
                              {classIcon[v.type]||<AlertTriangle className="w-3.5 h-3.5"/>}
                              <span className="font-medium">{v.description}</span>
                              <span className="ml-auto font-mono">{v.count}x</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold
                                ${v.severity==="CRITICAL"?"bg-red-800 text-red-200":"bg-orange-800 text-orange-200"}`}>{v.severity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-green-400 bg-green-950/30 border border-green-900 rounded px-3 py-2">
                        <CheckCircle2 className="w-4 h-4"/> No violations — fully compliant!
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-mono text-[--text-muted] uppercase tracking-widest mb-1.5">All Detections</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(report.class_counts).sort((a,b)=>b[1]-a[1]).map(([cls,cnt]) => (
                          <span key={cls} className="flex items-center gap-1 text-[11px] font-mono bg-[--elevated] border border-[--border] text-[--text-secondary] px-2 py-0.5 rounded-full">
                            {classIcon[cls]||null} {cls} <span className="text-[--brand-accent]">x{cnt}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {tab==="frames"   && <SnapshotCarousel frames={report.snapshot_frames} />}
              {tab==="timeline" && <TimelineBar timeline={report.timeline} />}
              {tab==="alerts"   && <AlertLog alerts={alerts} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Streaming card ───────────────────────────────────────────────────────────
function StreamCard({ video }: { video: VideoState }) {
  const [open, setOpen] = useState(true);

  if (video.status === "done" && video.report) {
    return <ReportCard report={video.report} alerts={video.alerts} />;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border bg-[--surface] overflow-hidden
        ${video.status==="error" ? "border-red-900" : video.pct > 0 ? "border-[--brand-accent]/40" : "border-[--border]"}`}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[--elevated]/40 transition-colors">
        <Video className="w-4 h-4 text-[--brand-accent] flex-shrink-0" />
        <span className="font-mono text-sm text-[--text-primary] truncate flex-1 text-left">{video.filename}</span>
        <div className="flex items-center gap-2 ml-auto">
          {video.status==="streaming" && (
            <span className="flex items-center gap-1 text-xs text-[--brand-accent] font-mono animate-pulse">
              <Activity className="w-3.5 h-3.5" /> {video.pct}%
            </span>
          )}
          {video.status==="error" && <XCircle className="w-4 h-4 text-red-400" />}
          {open ? <ChevronDown className="w-4 h-4 text-[--text-muted]"/> : <ChevronRight className="w-4 h-4 text-[--text-muted]"/>}
        </div>
      </button>
      {video.status==="streaming" && (
        <div className="h-0.5 w-full bg-[--border]">
          <div className="h-full bg-[--brand-accent] transition-all duration-300" style={{ width: `${video.pct}%` }} />
        </div>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t border-[--border] mt-0">
              {video.error && <p className="text-xs text-red-400 mt-3">{video.error}</p>}
              {!video.error && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Live preview */}
                  <div className="flex flex-col gap-3">
                    <LiveView video={video} />
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label:"Frame",  val:video.framesDone,          color:"text-[--text-primary]" },
                        { label:"Time",   val:`${video.liveTs.toFixed(1)}s`, color:"text-[--text-primary]" },
                        { label:"Alerts", val:video.alerts.length,       color:video.alerts.length>0?"text-red-400":"text-green-400" },
                        { label:"Done",   val:`${video.pct}%`,           color:"text-[--brand-accent]" },
                      ].map(({ label, val, color }) => (
                        <div key={label} className="rounded bg-[--elevated] border border-[--border] px-2 py-1.5 text-center">
                          <div className={`text-sm font-mono font-bold ${color}`}>{val}</div>
                          <div className="text-[9px] text-[--text-muted]">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Alert log */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <BellRing className="w-3.5 h-3.5 text-[--brand-accent]" />
                      <p className="text-xs font-mono text-[--text-muted] uppercase tracking-widest">Live Alerts</p>
                      {video.alerts.filter(a => a.severity==="CRITICAL").length > 0 && (
                        <span className="ml-auto text-[10px] bg-red-900/60 text-red-300 border border-red-800 px-1.5 py-0.5 rounded-full font-mono animate-pulse">
                          {video.alerts.filter(a => a.severity==="CRITICAL").length} CRITICAL
                        </span>
                      )}
                    </div>
                    <AlertLog alerts={video.alerts} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ForensicsPage() {
  const [videos, setVideos] = useState<VideoState[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<File[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const dismissToast = useCallback((id: string) => setToasts(p => p.filter(t => t.id !== id)), []);

  const pushToast = useCallback((t: Omit<Toast,"id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(p => [...p.slice(-4), { ...t, id }]);
    setTimeout(() => dismissToast(id), t.severity==="CRITICAL" ? 8000 : 5000);
  }, [dismissToast]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f =>
      [".mp4",".avi",".mov",".mkv",".webm",".m4v"].some(e => f.name.toLowerCase().endsWith(e))
    );
    setPending(p => [...p, ...arr]);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const run = useCallback(async () => {
    if (!pending.length || streaming) return;
    setServerError(null);
    setStreaming(true);

    const initStates: VideoState[] = pending.map((f, i) => ({
      id: `v${i}-${Date.now()}`, filename: f.name, status: "queued",
      pct: 0, liveSnapshot: null, liveClasses: [], liveTs: 0,
      framesDone: 0, totalFrames: 0, fps: 0, duration: 0,
      alerts: [], timeline: [], report: null, error: null,
    }));
    setVideos(p => [...initStates, ...p]);
    setPending([]);

    const form = new FormData();
    for (const f of pending) form.append("files", f, f.name);

    try {
      const res = await fetch(STREAM_URL, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Server ${res.status}: ${await res.text()}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const vidMap: Record<string, string> = {};

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let evt: SSEEvt;
          try { evt = JSON.parse(line.slice(6)); } catch { continue; }

          if (evt.type === "start") {
            const e = evt as unknown as StartEvt;
            const idx = initStates.findIndex(s => s.filename === e.filename);
            if (idx >= 0) {
              vidMap[e.video_id] = initStates[idx].id;
              setVideos(p => p.map(v => v.id===initStates[idx].id
                ? { ...v, status:"streaming", totalFrames:e.total_frames, fps:e.fps, duration:e.duration_sec }
                : v));
            }
          }

          if (evt.type === "frame") {
            const e = evt as unknown as FrameEvent;
            const sid = vidMap[e.video_id];
            if (!sid) continue;
            setVideos(p => p.map(v => v.id===sid ? {
              ...v, status:"streaming", pct:e.pct,
              liveSnapshot: e.snapshot || v.liveSnapshot,
              liveClasses: e.classes, liveTs: e.ts, framesDone: e.frames_done,
            } : v));
          }

          if (evt.type === "alert") {
            const e = evt as unknown as AlertEvt;
            const sid = vidMap[e.video_id];
            const fname = sid ? initStates.find(s => s.id===sid)?.filename || "" : "";
            if (sid) setVideos(p => p.map(v => v.id===sid ? { ...v, alerts:[...v.alerts, e] } : v));
            pushToast({ severity:e.severity, desc:e.desc, class_name:e.class, snapshot:e.snapshot, ts:e.ts, filename:fname });
          }

          if (evt.type === "done") {
            const e = evt as unknown as DoneEvt;
            const sid = vidMap[e.video_id];
            if (!sid) continue;
            setVideos(p => p.map(v => v.id===sid ? { ...v, status:"done", pct:100, report:e } : v));
          }

          if (evt.type === "error") {
            const sid = evt.video_id ? vidMap[evt.video_id as string] : undefined;
            if (sid) setVideos(p => p.map(v => v.id===sid ? { ...v, status:"error", error:evt.msg as string } : v));
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setServerError(msg);
      setVideos(p => p.map(v =>
        v.status==="streaming"||v.status==="queued" ? { ...v, status:"error", error:msg } : v
      ));
    } finally {
      setStreaming(false);
    }
  }, [pending, streaming, pushToast]);

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismissToast} />
      <div className="flex flex-col gap-6 py-2">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-display text-[--text-display] flex items-center gap-2">
              <ScanSearch className="w-5 h-5 text-[--brand-accent]" />
              Video Forensics
              <span className="text-xs font-mono text-[--brand-accent] bg-[--brand-accent-subtle] border border-[--brand-accent]/20 px-2 py-0.5 rounded-full">
                LIVE STREAM
              </span>
            </h1>
            <p className="text-sm text-[--text-secondary] mt-0.5">
              Upload footage for real-time YOLO11s frame analysis. Watch detections live, receive instant alerts, get a full compliance report.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[--text-muted] bg-[--surface] border border-[--border] rounded px-2 py-1">
            <BarChart2 className="w-3 h-3" />
            <span className="font-mono">YOLO11s Stage 4 · best_s4.onnx · :8090</span>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          className={`relative rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
            flex flex-col items-center justify-center py-10 px-6 text-center group
            ${dragOver ? "border-[--brand-accent] bg-[--brand-accent-subtle] scale-[1.01]"
              : "border-[--border] hover:border-[--brand-accent]/50 hover:bg-[--surface]/60"}`}>
          <input ref={fileRef} id={inputId} type="file" multiple
            accept=".mp4,.avi,.mov,.mkv,.webm,.m4v" className="hidden"
            onChange={e => { addFiles(e.target.files!); e.target.value=""; }} />
          <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-4 transition-colors
            ${dragOver ? "bg-[--brand-accent] border-[--brand-accent]" : "bg-[--elevated] border-[--border] group-hover:border-[--brand-accent]/40"}`}>
            <Upload className={`w-6 h-6 ${dragOver ? "text-white" : "text-[--brand-accent]"}`} />
          </div>
          <p className="text-sm font-semibold text-[--text-primary]">
            Drop video files here or <span className="text-[--brand-accent] underline underline-offset-2">browse</span>
          </p>
          <p className="text-xs text-[--text-muted] mt-1">MP4 · AVI · MOV · MKV · WebM · Multiple files allowed</p>
          <div className="flex items-center gap-4 mt-3">
            {[
              { icon:<Activity className="w-3 h-3"/>, label:"Live frame tracking" },
              { icon:<BellRing className="w-3 h-3"/>, label:"Instant alerts" },
              { icon:<BarChart2 className="w-3 h-3"/>, label:"Compliance report" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-1 text-[10px] font-mono text-[--text-muted]">
                <span className="text-[--brand-accent]">{icon}</span> {label}
              </div>
            ))}
          </div>
        </div>

        {/* Pending queue */}
        <AnimatePresence>
          {pending.length > 0 && (
            <motion.div initial={{ opacity:0,y:6 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:6 }}
              className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono text-[--text-muted] uppercase tracking-widest">
                  Ready ({pending.length} file{pending.length!==1?"s":""})
                </p>
                <button onClick={run} disabled={streaming}
                  className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-semibold
                    bg-[--brand-accent] hover:bg-[--brand-accent-hover] text-white shadow
                    disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <Zap className="w-3.5 h-3.5" />
                  {streaming ? "Streaming..." : "Start Live Analysis"}
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {pending.map((f, i) => (
                  <div key={`${f.name}-${i}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[--elevated] border border-[--border]">
                    <FileVideo className="w-4 h-4 text-[--brand-accent]" />
                    <span className="flex-1 text-xs font-mono text-[--text-primary] truncate">{f.name}</span>
                    <span className="text-[10px] text-[--text-muted]">
                      {f.size>1e6 ? `${(f.size/1e6).toFixed(1)} MB` : `${(f.size/1e3).toFixed(0)} KB`}
                    </span>
                    <button onClick={() => setPending(p => p.filter((_,j)=>j!==i))}
                      className="p-1 rounded hover:bg-[--border]">
                      <Trash2 className="w-3.5 h-3.5 text-[--text-muted] hover:text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {serverError && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-red-900 bg-red-950/30 text-sm text-red-400">
            <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Connection error</p>
              <p className="text-xs mt-0.5 opacity-70">{serverError}</p>
              <p className="text-xs mt-1.5 font-mono opacity-50">
                Start: <code>cd edge && python -m app.forensics_server</code>
              </p>
            </div>
          </div>
        )}

        {/* Video cards */}
        {videos.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono text-[--text-muted] uppercase tracking-widest">
                {streaming ? "Analyzing..." : "Results"} ({videos.length})
              </p>
              {!streaming && (
                <button onClick={() => setVideos([])}
                  className="text-[10px] font-mono text-[--text-muted] hover:text-red-400 px-2 py-0.5 rounded border border-[--border] hover:border-red-900 transition-colors">
                  Clear All
                </button>
              )}
            </div>
            {videos.map(v => <StreamCard key={v.id} video={v} />)}
          </div>
        )}

        {/* Empty state */}
        {!streaming && videos.length===0 && pending.length===0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[--elevated] border border-[--border] flex items-center justify-center">
              <Video className="w-7 h-7 text-[--text-muted]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[--text-secondary]">No videos analyzed yet</p>
              <p className="text-xs text-[--text-muted] mt-1">Upload factory footage above for real-time safety analysis</p>
            </div>
            <div className="flex items-center gap-6 mt-2">
              {[
                { icon:<Activity className="w-4 h-4 text-[--brand-accent]"/>, label:"Live frame tracking" },
                { icon:<BellRing className="w-4 h-4 text-red-400"/>, label:"Instant critical alerts" },
                { icon:<ScanSearch className="w-4 h-4 text-blue-400"/>, label:"Full compliance report" },
              ].map(({ icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  {icon}
                  <span className="text-[10px] text-[--text-muted] font-mono">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
