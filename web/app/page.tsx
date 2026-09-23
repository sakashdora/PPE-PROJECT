"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArgusEyeLogo } from "@/components/ArgusEyeLogo";
import { SystemBootSequence } from "@/components/SystemBootSequence";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  Server,
  Flame,
  CheckCircle2,
  HardHat,
  Cpu,
  Radio,
  Film,
  Terminal,
  UserCheck,
  Shield,
  Building2,
} from "lucide-react";

export default function LandingPage() {
  const [booting, setBooting] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"supervisor" | "auditor" | "director">("supervisor");

  const count1Ref = useRef<HTMLSpanElement>(null);
  const count2Ref = useRef<HTMLSpanElement>(null);
  const count3Ref = useRef<HTMLSpanElement>(null);

  // GSAP 1.8s counter animation on mount
  useGSAP(() => {
    const obj = { val1: 0, val2: 0, val3: 100 };

    gsap.to(obj, {
      val1: 99.2,
      duration: 1.8,
      ease: "power2.out",
      onUpdate: () => {
        if (count1Ref.current) count1Ref.current.innerText = `${obj.val1.toFixed(1)}%`;
      },
    });

    gsap.to(obj, {
      val2: 31.8,
      duration: 1.8,
      ease: "power2.out",
      onUpdate: () => {
        if (count2Ref.current) count2Ref.current.innerText = `${obj.val2.toFixed(1)}ms`;
      },
    });

    gsap.to(obj, {
      val3: 0,
      duration: 1.8,
      ease: "power2.out",
      onUpdate: () => {
        if (count3Ref.current) count3Ref.current.innerText = `${Math.round(obj.val3)}`;
      },
    });
  }, []);

  return (
    <div className="min-h-screen bg-base text-text-primary flex flex-col justify-between selection:bg-copper selection:text-base font-sans relative overflow-hidden">
      {/* System Boot Sequence Overlay when triggered */}
      {booting && <SystemBootSequence />}

      {/* Hero Radial Background Wash using --personality-rose (#7A4560) ONLY on Landing Hero */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] pointer-events-none z-0 opacity-40 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(122, 69, 96, 0.4) 0%, rgba(22, 20, 15, 0) 70%)",
        }}
      />

      {/* ── Top Header Bar ── */}
      <header className="w-full bg-surface/80 border-b border-border px-4 py-2.5 flex items-center justify-between text-2xs font-mono relative z-10 select-none">
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
          <span className="text-text-secondary hidden sm:inline">HEAVY INDUSTRY EDGE SAFETY</span>
          <span className="text-border hidden sm:inline">|</span>
          <span className="text-slate-connect font-semibold hidden md:inline">● EDGE CLUSTER LIVE</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setBooting(true)}
            className="px-3.5 py-1.5 bg-copper hover:bg-copper-hover text-base font-bold rounded-sm text-xs flex items-center gap-1.5 transition-colors font-mono"
          >
            <span>ENTER MISSION CONTROL</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <main className="w-full max-w-6xl mx-auto px-4 py-12 flex-1 flex flex-col justify-center items-center text-center relative z-10">
        {/* Interactive Eye Logo Tracking Mouse Pointer */}
        <div className="mb-6 cursor-pointer" onClick={() => setBooting(true)}>
          <ArgusEyeLogo size={90} interactive showText subtitle="Zero-Cloud Edge Vision" />
        </div>

        {/* Hero Headline (DM Serif Display - ONLY for Landing Hero <h1>) */}
        <div className="max-w-4xl space-y-4">
          <h1 className="font-serif-hero text-4xl sm:text-6xl text-text-primary tracking-tight leading-tight">
            Industrial Safety Intelligence
          </h1>

          {/* Subtitle in Hanken Grotesk */}
          <p className="font-sans-body text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            Real-time zero-cloud edge vision for heavy industry: fire, smoke, and PPE compliance monitoring powered by YOLO11s ONNX edge inference.
          </p>
        </div>

        {/* Role Selector */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 font-mono text-2xs">
          <span className="text-text-secondary mr-2 uppercase tracking-wider">SELECT OPERATOR ROLE:</span>
          <button
            type="button"
            onClick={() => setSelectedRole("supervisor")}
            className={`px-3 py-1.5 rounded-sm border flex items-center gap-1.5 transition-colors ${
              selectedRole === "supervisor"
                ? "bg-copper/20 border-copper text-copper font-bold"
                : "bg-surface border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>SHIFT SUPERVISOR</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedRole("auditor")}
            className={`px-3 py-1.5 rounded-sm border flex items-center gap-1.5 transition-colors ${
              selectedRole === "auditor"
                ? "bg-copper/20 border-copper text-copper font-bold"
                : "bg-surface border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>SAFETY AUDITOR</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedRole("director")}
            className={`px-3 py-1.5 rounded-sm border flex items-center gap-1.5 transition-colors ${
              selectedRole === "director"
                ? "bg-copper/20 border-copper text-copper font-bold"
                : "bg-surface border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>PLANT DIRECTOR</span>
          </button>
        </div>

        {/* Primary CTA Button */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
          <button
            type="button"
            onClick={() => setBooting(true)}
            className="px-8 py-3.5 bg-copper hover:bg-copper-hover text-base font-extrabold font-mono text-sm rounded-sm flex items-center gap-2.5 shadow-xl transition-all hover:scale-[1.02]"
          >
            <span>ENTER MISSION CONTROL</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <Link
            href="/copilot"
            className="px-6 py-3.5 bg-surface hover:bg-elevated border border-border text-text-primary font-mono text-sm rounded-sm flex items-center gap-2 transition-colors"
          >
            <Terminal className="w-4 h-4 text-copper" />
            <span>ASK COPILOT</span>
          </Link>
        </div>

        {/* ── 3 Proof Metric Cards with GSAP Animated Counters ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mt-14 text-left">
          {/* Proof 1 */}
          <div className="p-5 bg-surface border border-border rounded-sm relative overflow-hidden group hover:border-copper transition-colors">
            <div className="text-3xs font-mono text-text-secondary uppercase tracking-wider mb-2">
              FIRE & SMOKE RECALL RATE
            </div>
            <div className="text-3xl font-extrabold font-display text-copper">
              <span ref={count1Ref}>0.0%</span>
            </div>
            <div className="text-2xs font-mono text-text-secondary mt-2">
              Zero tolerance for missed flames; empirically verified across 2,400+ domain frames.
            </div>
          </div>

          {/* Proof 2 */}
          <div className="p-5 bg-surface border border-border rounded-sm relative overflow-hidden group hover:border-copper transition-colors">
            <div className="text-3xs font-mono text-text-secondary uppercase tracking-wider mb-2">
              PER-FRAME EDGE LATENCY
            </div>
            <div className="text-3xl font-extrabold font-display text-slate-connect">
              <span ref={count2Ref}>0.0ms</span>
            </div>
            <div className="text-2xs font-mono text-text-secondary mt-2">
              INT8 OpenVINO pipeline running on local 15W edge hardware. SLA &lt; 50ms.
            </div>
          </div>

          {/* Proof 3 */}
          <div className="p-5 bg-surface border border-border rounded-sm relative overflow-hidden group hover:border-copper transition-colors">
            <div className="text-3xs font-mono text-text-secondary uppercase tracking-wider mb-2">
              CLOUD DATA LEAKAGE
            </div>
            <div className="text-3xl font-extrabold font-display text-safe">
              <span ref={count3Ref}>100</span>
            </div>
            <div className="text-2xs font-mono text-text-secondary mt-2">
              100% air-gapped zero-cloud mode. Video tensors never leave facility LAN.
            </div>
          </div>
        </div>
      </main>

      {/* ── Minimal Footer ── */}
      <footer className="w-full bg-surface border-t border-border px-4 py-3 text-3xs font-mono text-text-secondary text-center relative z-10">
        <span>ARGUS AI v2.0 — Heavy Industry Edge Vision</span>
      </footer>
    </div>
  );
}
