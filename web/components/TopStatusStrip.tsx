"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import { selectUnackedCritical } from "@/features/alerts/selectors";
import { Shield, AlertTriangle, ChevronRight, Activity, Volume2, VolumeX, Sparkles, Settings, User } from "lucide-react";
import { audioController } from "@/lib/audio";

export const TopStatusStrip: React.FC = () => {
  const byId = useAlertsStore((s) => s.byId);
  const conn = useAlertsStore((s) => s.conn);
  const cursor = useAlertsStore((s) => s.cursor);
  const setSelectedAlertId = useAlertsStore((s) => s.setSelectedAlertId);

  const [muted, setMuted] = useState(false);
  const [latency, setLatency] = useState(14);

  const unackedCritical = selectUnackedCritical(byId);
  const activeCritical = unackedCritical[0];

  // Alternating browser tab title when a critical alarm is active
  useEffect(() => {
    if (!activeCritical) {
      document.title = "ARGUS AI — Mission Control";
      return;
    }
    let toggle = false;
    const interval = setInterval(() => {
      toggle = !toggle;
      document.title = toggle
        ? `🚨 FIRE/CRITICAL [${activeCritical.sector}]`
        : `ARGUS AI — IMMEDIATE ACTION REQ`;
    }, 800);
    return () => {
      clearInterval(interval);
      document.title = "ARGUS AI — Mission Control";
    };
  }, [activeCritical]);

  // Subtle realistic ping jitter for edge telemetry display
  useEffect(() => {
    const timer = setInterval(() => {
      setLatency(12 + Math.floor(Math.random() * 5));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleMuteToggle = () => {
    const next = audioController.toggleMute();
    setMuted(next);
  };

  const audioUnlocked = useAlertsStore((s) => s.audioUnlocked);
  const setAudioUnlocked = useAlertsStore((s) => s.setAudioUnlocked);

  return (
    <header className="w-full h-9 bg-surface border-b border-border flex items-center justify-between px-3 text-xs select-none z-40 relative">
      {/* Left: Brand Identity & Active Facility Indicator */}
      <div className="flex items-center gap-3 shrink-0">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-4 h-4 bg-brand-accent flex items-center justify-center rounded-sm">
            <div className="w-1.5 h-1.5 bg-base" />
          </div>
          <span className="font-display font-bold text-text-primary tracking-wider text-xs uppercase group-hover:text-brand-accent transition-colors">
            ARGUS AI
          </span>
        </Link>
        <span className="text-border">|</span>
        <div className="hidden sm:flex items-center gap-1.5 text-2xs font-mono text-text-secondary">
          <span className="text-text-primary font-semibold">FACILITY 04</span>
          <span>•</span>
          <span className="text-slate-connect font-semibold">EDGE CLUSTER 01</span>
        </div>
      </div>

      {/* Center: Single-line Status / Alert Notification (In-place replacement, NO vertical stacking) */}
      <div className="flex-1 max-w-2xl mx-4 overflow-hidden text-center flex items-center justify-center">
        {activeCritical ? (
          <div className="flex items-center gap-2.5 px-3 py-0.5 bg-critical-bg border border-critical rounded-sm text-text-primary text-2xs font-mono animate-critical-pulse">
            <AlertTriangle className="w-3 h-3 text-critical shrink-0" />
            <span className="font-bold text-critical uppercase">CRITICAL HAZARD:</span>
            <span className="truncate">
              {activeCritical.items.join(" & ").toUpperCase()} in {activeCritical.sector} ({activeCritical.cameraId.toUpperCase()})
            </span>
            <Link
              href="/alerts"
              onClick={() => setSelectedAlertId(activeCritical.id)}
              className="ml-1 text-critical underline hover:text-text-primary flex items-center font-bold"
            >
              TRIAGE NOW <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-2xs font-mono text-text-secondary truncate">
            <span className="flex items-center gap-1 text-slate-connect">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-connect" />
              <span className="font-bold">4 Cameras Online</span>
            </span>
            <span className="text-border">•</span>
            <span className="text-text-secondary">WS Live</span>
            <span className="text-border">•</span>
            <span className="text-text-primary font-medium">System Armed</span>
          </div>
        )}
      </div>

      {/* Right: Operational Telemetry & Quick Action */}
      <div className="flex items-center gap-3 shrink-0 text-2xs font-mono">
        {/* WS State */}
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              conn === "live"
                ? "bg-slate-connect"
                : conn === "connecting" || conn === "reconnecting"
                ? "bg-warning"
                : "bg-critical"
            }`}
          />
          <span className="text-text-secondary hidden sm:inline">
            {conn === "live" ? "WS ONLINE" : conn === "connecting" || conn === "reconnecting" ? "SYNCING" : "OFFLINE"}
          </span>
          <span className="text-text-secondary font-mono">{latency}ms</span>
        </div>

        <span className="text-border">|</span>

        {/* Audio Siren Controller (Inline Arm / Mute) */}
        {!audioUnlocked ? (
          <button
            onClick={() => setAudioUnlocked(true)}
            className="px-2 py-0.5 bg-warning text-base font-bold text-[10px] rounded-sm flex items-center gap-1 transition-transform hover:scale-105"
            title="Click to enable browser siren audio"
          >
            <VolumeX className="w-3 h-3" />
            <span>ARM SIREN</span>
          </button>
        ) : (
          <button
            onClick={handleMuteToggle}
            title={muted ? "Unmute Siren" : "Mute Siren"}
            className="text-text-secondary hover:text-text-primary transition-colors p-1"
          >
            {muted ? (
              <VolumeX className="w-3.5 h-3.5 text-warning" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-slate-connect" />
            )}
          </button>
        )}
        
        <span className="text-border">|</span>

        <Link
          href="/settings"
          className="text-text-secondary hover:text-brand-accent transition-colors p-1"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </Link>
        <Link
          href="/profile"
          className="text-text-secondary hover:text-brand-accent transition-colors p-1"
          title="Profile"
        >
          <User className="w-4 h-4" />
        </Link>

      </div>
    </header>
  );
};
