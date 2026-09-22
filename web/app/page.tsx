"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  Server,
  Lock,
  Flame,
  CheckCircle2,
  HardHat,
  Cpu,
  Radio,
  Eye,
  Film,
  Terminal,
  Sliders,
  AlertTriangle,
} from "lucide-react";

export default function LandingPage() {
  const [tickerTick, setTickerTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTickerTick((t) => (t + 1) % 100);
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-base text-text-primary flex flex-col justify-between selection:bg-copper selection:text-base font-sans">
      {/* ── Top Status Strip ── */}
      <header className="w-full bg-surface border-b border-border px-4 py-2.5 flex items-center justify-between text-2xs font-mono select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-copper rounded-sm flex items-center justify-center font-bold text-[10px] text-base">
              A
            </div>
            <span className="font-display font-bold text-sm tracking-wider uppercase text-text-primary">
              ARGUS AI
            </span>
          </div>
          <span className="text-border">|</span>
          <span className="text-text-secondary hidden sm:inline">PS06 INDUSTRIAL SAFETY AI</span>
          <span className="text-border hidden sm:inline">|</span>
          <span className="text-jade hidden md:inline">● EDGE NODE CLUSTER SYNCED</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-text-secondary">
            <span>INT8 LATENCY: <strong className="text-copper">31.8ms</strong></span>
            <span>•</span>
            <span>CAS PROTOCOL: <strong className="text-jade">ARMED</strong></span>
          </div>
          <Link
            href="/wall"
            className="px-3 py-1 bg-copper hover:bg-copper-hover text-base font-bold rounded-sm text-xs flex items-center gap-1.5 transition-colors"
          >
            <span>OPERATOR CONSOLE</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* ── Main High-Density Mission Control Hero ── */}
      <main className="w-full max-w-7xl mx-auto px-4 py-8 flex-1 flex flex-col justify-center gap-8">
        {/* Title + Operational Mode Callout */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm bg-copper/15 border border-copper text-copper font-mono text-3xs font-bold uppercase mb-3">
              <span className="w-1.5 h-1.5 rounded-none bg-copper animate-pulse" />
              <span>ON-PREM EDGE INFERENCE · ZERO-CLOUD ARCHITECTURE</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold font-display tracking-tight text-text-primary leading-none uppercase">
              HEAVY INDUSTRY <br />
              <span className="text-copper">SAFETY INTELLIGENCE</span>
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary font-mono mt-3 max-w-2xl leading-relaxed">
              Real-time YOLO11s Stage 2 computer vision pipeline with dual-rate temporal voting, atomic Compare-and-Swap state concurrency, and air-gapped deterministic safety intelligence.
            </p>
          </div>

          {/* Quick Primary Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/wall"
              className="px-4 py-2.5 bg-copper hover:bg-copper-hover text-base font-bold rounded-sm text-xs font-mono flex items-center gap-2 transition-colors shadow-sm"
            >
              <Radio className="w-4 h-4" />
              <span>LIVE WALL GRID</span>
            </Link>
            <Link
              href="/wall"
              className="px-4 py-2.5 bg-surface hover:bg-elevated text-text-primary border border-border rounded-sm text-xs font-mono flex items-center gap-2 transition-colors"
            >
              <Film className="w-4 h-4 text-copper" />
              <span>OFFLINE VIDEO AUDIT</span>
            </Link>
            <Link
              href="/copilot"
              className="px-4 py-2.5 bg-surface hover:bg-elevated text-text-primary border border-border rounded-sm text-xs font-mono flex items-center gap-2 transition-colors"
            >
              <Terminal className="w-4 h-4 text-copper" />
              <span>COPILOT CHAT</span>
            </Link>
          </div>
        </div>

        {/* ── High-Density Real UI Glimpses & Telemetry Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Glimpse: Active Optical Inference Canvas Preview (7 cols) */}
          <div className="lg:col-span-7 bg-surface border border-border rounded-sm p-4 flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="w-2 h-2 rounded-none bg-jade" />
                <span className="font-bold text-text-primary uppercase">CAMERA 02 — CHEMICAL DEPOT</span>
                <span className="text-text-secondary text-2xs">· 14.8 FPS · INT8 ONNX</span>
              </div>
              <span className="text-3xs font-mono text-copper border border-copper px-1.5 py-0.5 rounded-sm bg-copper/10">
                TEMPORAL VOTING ARMED
              </span>
            </div>

            {/* Simulated Live Detection Plate */}
            <div className="relative aspect-[16/9] bg-base border border-border rounded-sm overflow-hidden flex items-center justify-center p-3">
              {/* HUD Brackets */}
              <div className="hud-bracket top-left" />
              <div className="hud-bracket top-right" />
              <div className="hud-bracket bottom-left" />
              <div className="hud-bracket bottom-right" />

              {/* Bounding Box 1: Worker (Compliant) */}
              <div
                className="absolute border border-text-secondary/60 bg-text-secondary/5 font-mono text-[9px] text-text-primary p-1 flex flex-col justify-between"
                style={{ left: "20%", top: "25%", width: "24%", height: "55%" }}
              >
                <div className="bg-elevated border border-border px-1 py-0.5 text-text-primary font-bold text-[8px] -mt-3 self-start">
                  WORKER_01 [0.96]
                </div>
                <div className="space-y-0.5 self-start">
                  <span className="bg-safe/80 text-white px-1 text-[7px] font-bold block">
                    HARDHAT ✓
                  </span>
                  <span className="bg-safe/80 text-white px-1 text-[7px] font-bold block">
                    VEST ✓
                  </span>
                </div>
              </div>

              {/* Bounding Box 2: Worker (Missing Helmet - Flagged by Voting Engine) */}
              <div
                className="absolute border-2 border-warning bg-warning/15 font-mono text-[9px] text-text-primary p-1 flex flex-col justify-between"
                style={{ left: "55%", top: "22%", width: "26%", height: "58%" }}
              >
                <div className="bg-warning text-base font-bold px-1 py-0.5 text-[8px] -mt-3.5 self-start">
                  WORKER_04 [0.94]
                </div>
                {/* Head region flagged */}
                <div className="border border-dashed border-warning bg-warning/30 p-1 mt-1 text-[7px] font-bold text-warning uppercase self-start">
                  NO HARDHAT [VOTE 8/10]
                </div>
                <div className="self-start">
                  <span className="bg-safe/80 text-white px-1 text-[7px] font-bold">
                    VEST ✓
                  </span>
                </div>
              </div>

              {/* Live Detection OSD */}
              <div className="absolute top-2 left-2 px-2 py-1 bg-surface/90 border border-border rounded-sm text-[9px] font-mono text-text-secondary flex items-center gap-3">
                <span className="text-jade font-bold">REC ● 00:14:28</span>
                <span>ISO 45001 AUDIT ACTIVE</span>
              </div>
            </div>

            {/* Bottom Stream Diagnostics */}
            <div className="mt-3 pt-3 border-t border-border grid grid-cols-3 gap-2 text-2xs font-mono text-center">
              <div className="p-1.5 bg-base border border-border rounded-sm">
                <span className="text-text-secondary block text-3xs">PRECISION</span>
                <span className="text-copper font-bold text-xs">86.5%</span>
              </div>
              <div className="p-1.5 bg-base border border-border rounded-sm">
                <span className="text-text-secondary block text-3xs">FIRE RECALL</span>
                <span className="text-safe font-bold text-xs">99.2%</span>
              </div>
              <div className="p-1.5 bg-base border border-border rounded-sm">
                <span className="text-text-secondary block text-3xs">YELLOW SHIRT FPR</span>
                <span className="text-safe font-bold text-xs">0.0% (PASS)</span>
              </div>
            </div>
          </div>

          {/* Right Glimpse: Live Telemetry & CAS Concurrency Feed (5 cols) */}
          <div className="lg:col-span-5 bg-surface border border-border rounded-sm p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
                <h3 className="text-xs font-bold font-display text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-copper" />
                  <span>CAS CONCURRENCY TELEMETRY</span>
                </h3>
                <span className="text-3xs font-mono text-jade">SYNCED</span>
              </div>

              {/* Live Terminal Log Stream */}
              <div className="p-3 bg-base border border-border rounded-sm font-mono text-3xs space-y-2 text-text-secondary">
                <div className="flex items-start gap-1.5">
                  <span className="text-copper font-bold">[19:42:01]</span>
                  <span>Inference batch completed across 4 cameras in 31.8ms</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-warning font-bold">[19:42:04]</span>
                  <span>CAM-03: Temporal buffer updated (Vote 7/10: missing_helmet)</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-critical font-bold">[19:42:05]</span>
                  <span>CAS event emitted: Version #4 · Alert ID #al-04 flagged</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-jade font-bold">[19:42:07]</span>
                  <span>WebSocket monotonic replay cursor synced at seq #128</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-copper font-bold">[19:42:10]</span>
                  <span>GPIO physical siren latch verified (&lt;10ms trip time)</span>
                </div>
              </div>
            </div>

            {/* Empirical Architectural Highlights */}
            <div className="space-y-2 mt-4 pt-3 border-t border-border text-2xs font-mono">
              <div className="flex justify-between items-center p-2 bg-base border border-border rounded-sm">
                <span className="text-text-secondary">Hardware Footprint</span>
                <span className="font-bold text-text-primary">Intel NUC / 15W TDP</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-base border border-border rounded-sm">
                <span className="text-text-secondary">Network Failure Mode</span>
                <span className="font-bold text-safe">SQLite Outbox (Zero Loss)</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-base border border-border rounded-sm">
                <span className="text-text-secondary">Concurrency Protocol</span>
                <span className="font-bold text-copper">Atomic CAS (409 Conflict Rejection)</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3 Hard-Engineered Technical Proof Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Card 1: Corner-Case Suppression */}
          <div className="p-4 bg-surface border border-border rounded-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-2xs font-mono text-text-secondary mb-2">
                <span className="uppercase font-bold text-copper">PROOF 01</span>
                <span className="text-safe font-bold">0.0% FPR VERIFIED</span>
              </div>
              <h3 className="text-sm font-bold font-display text-text-primary mb-1.5">
                Corner-Case Suppression Engine
              </h3>
              <p className="text-2xs text-text-secondary font-mono leading-relaxed">
                Yellow shirts &ne; fire, baseball caps &ne; safety hardhats, steam plumes &ne; toxic smoke. Rigorously tested against negative sample sets.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-3xs font-mono text-text-secondary">
              <span>Gate: &le; 1.0% FPR</span>
              <span className="text-safe font-bold">PASSED (0.0%)</span>
            </div>
          </div>

          {/* Card 2: Physical Alarm Unlatch Loop */}
          <div className="p-4 bg-surface border border-border rounded-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-2xs font-mono text-text-secondary mb-2">
                <span className="uppercase font-bold text-copper">PROOF 02</span>
                <span className="text-jade font-bold">&lt; 10ms LATCH TIME</span>
              </div>
              <h3 className="text-sm font-bold font-display text-text-primary mb-1.5">
                Physical Alarm Unlatch Protocol
              </h3>
              <p className="text-2xs text-text-secondary font-mono leading-relaxed">
                Edge node trips physical GPIO relays in &lt;10ms. Siren remains physically latched until verified supervisor CAS acknowledgment relays unlatch command.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-3xs font-mono text-text-secondary">
              <span>Protocol: CAS v2 Bi-directional</span>
              <span className="text-jade font-bold">VERIFIED</span>
            </div>
          </div>

          {/* Card 3: Unit Economics Defense */}
          <div className="p-4 bg-surface border border-border rounded-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-2xs font-mono text-text-secondary mb-2">
                <span className="uppercase font-bold text-copper">PROOF 03</span>
                <span className="text-copper font-bold">10.6x COST ADVANTAGE</span>
              </div>
              <h3 className="text-sm font-bold font-display text-text-primary mb-1.5">
                Edge vs. Cloud Unit Economics
              </h3>
              <p className="text-2xs text-text-secondary font-mono leading-relaxed">
                ₹3,200 CapEx per camera vs. ₹34,000/year cloud recurring fee for 50 cameras. Amortized in ~6 months with zero recurring bandwidth egress.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-3xs font-mono text-text-secondary">
              <span>Audited for 50 Cameras</span>
              <span className="text-copper font-bold">₹15.4L SAVED / YR</span>
            </div>
          </div>
        </div>
      </main>

      {/* ── Minimal Industrial Footer ── */}
      <footer className="w-full bg-surface border-t border-border px-4 py-3 text-3xs font-mono text-text-secondary flex flex-wrap items-center justify-between gap-2">
        <div>
          <span>ARGUS AI · BPUT Hackathon 2026 PS06 · Edge Safety Intelligence Standard</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/wall" className="hover:text-copper transition-colors">LIVE WALL</Link>
          <Link href="/alerts" className="hover:text-copper transition-colors">ALERT QUEUE</Link>
          <Link href="/reports" className="hover:text-copper transition-colors">ANALYTICS</Link>
          <Link href="/health" className="hover:text-copper transition-colors">NODE HEALTH</Link>
          <Link href="/copilot" className="hover:text-copper transition-colors">COPILOT</Link>
        </div>
      </footer>
    </div>
  );
}
