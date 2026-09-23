"use client";

import React from "react";
import { User, ShieldCheck, Clock, CheckCircle2, Award, Activity, MapPin, Layers } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="space-y-6 pb-12">
      {/* ── Profile Hero Header Card (Uses DM Serif Display & --personality-rose wash) ── */}
      <div className="relative p-6 bg-surface border border-border rounded-sm overflow-hidden select-none">
        {/* Personality Rose Background Wash */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30 blur-2xl"
          style={{
            background: "radial-gradient(circle at top right, rgba(122, 69, 96, 0.5) 0%, rgba(33, 29, 23, 0) 70%)",
          }}
        />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-sm bg-copper/20 border-2 border-copper flex items-center justify-center text-copper font-bold text-xl">
              <User className="w-8 h-8 text-copper" />
            </div>

            <div>
              {/* User Name in DM Serif Display (The only operational screen allowed DM Serif Display for supervisor identity) */}
              <h1 className="font-serif-hero text-2xl sm:text-3xl text-text-primary">
                Shift Supervisor Rajesh Kumar
              </h1>
              <div className="text-2xs font-mono text-text-secondary mt-1 flex flex-wrap items-center gap-3">
                <span className="text-copper font-bold">ID: #SUP-0482</span>
                <span className="text-border">•</span>
                <span>FACILITY 04 — HEAVY FABRICATION</span>
                <span className="text-border">•</span>
                <span className="text-slate-connect font-bold">SHIFT A COMMANDER</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:items-end gap-3 font-mono text-2xs">
            <span className="px-3 py-1.5 bg-safe-bg text-safe border border-safe rounded-sm font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>CAS LEVEL 3 CLEARANCE</span>
            </span>
            <div className="flex items-center gap-2 mt-1">
              <button className="px-4 py-1.5 bg-copper hover:bg-copper-hover text-base font-bold rounded-sm transition-colors text-xs">
                EDIT CLEARANCE
              </button>
              <button className="px-4 py-1.5 bg-surface hover:bg-elevated border border-border rounded-sm transition-colors text-text-primary text-xs">
                END SHIFT LOGOUT
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Supervisor Telemetry & Performance Metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        <div className="p-4 bg-surface border border-border rounded-sm forge-surface-active">
          <div className="text-3xs text-text-secondary uppercase">SHIFTS COMPLETED</div>
          <div className="text-2xl font-bold font-display text-text-primary mt-1">142</div>
          <div className="text-[9px] text-text-secondary mt-1">Zero unhandled P0 safety breaches</div>
        </div>

        <div className="p-4 bg-surface border border-border rounded-sm forge-surface-active">
          <div className="text-3xs text-text-secondary uppercase">CAS ALERTS ACKNOWLEDGED</div>
          <div className="text-2xl font-bold font-display text-copper mt-1">849</div>
          <div className="text-[9px] text-text-secondary mt-1">Mean response SLA: 31.2s</div>
        </div>

        <div className="p-4 bg-surface border border-border rounded-sm forge-surface-active">
          <div className="text-3xs text-text-secondary uppercase">FALSE ALARMS DISMISSED</div>
          <div className="text-2xl font-bold font-display text-slate-connect mt-1">14</div>
          <div className="text-[9px] text-text-secondary mt-1">Steam/refraction feedback logged</div>
        </div>

        <div className="p-4 bg-surface border border-border rounded-sm forge-surface-active">
          <div className="text-3xs text-text-secondary uppercase">SECTOR AUTHORIZATION</div>
          <div className="text-2xl font-bold font-display text-safe mt-1">4 / 4</div>
          <div className="text-[9px] text-safe mt-1">Full plant wide jurisdiction</div>
        </div>
      </div>

      {/* ── Recent Supervisor Activity Log ── */}
      <div className="p-5 bg-surface border border-border rounded-sm space-y-4">
        <h3 className="text-sm font-bold font-display text-text-primary uppercase tracking-wider flex items-center gap-2 border-b border-border pb-3">
          <Activity className="w-4 h-4 text-copper" />
          <span>Supervisor CAS Action Trail</span>
        </h3>

        <div className="space-y-2.5 font-mono text-xs">
          <div className="p-3 bg-base border border-border rounded-sm flex items-start justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-safe shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-text-primary">
                  Acknowledged Alert #al-04 (Missing Helmet in Sector 3)
                </div>
                <div className="text-2xs text-text-secondary mt-0.5">
                  Remark: "Issued spare hardhat from Sector 3 storage cache."
                </div>
              </div>
            </div>
            <span className="text-2xs text-text-secondary shrink-0">14m ago</span>
          </div>

          <div className="p-3 bg-base border border-border rounded-sm flex items-start justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-safe shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-text-primary">
                  Resolved Alert #al-01 (Thermal Friction Smoke in Sector 2)
                </div>
                <div className="text-2xs text-text-secondary mt-0.5">
                  Remark: "Bearing cooled; maintenance team cleared conveyance line."
                </div>
              </div>
            </div>
            <span className="text-2xs text-text-secondary shrink-0">1h 12m ago</span>
          </div>

          <div className="p-3 bg-base border border-border rounded-sm flex items-start justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-copper shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-text-primary">
                  Shift Handover Checklist Verified
                </div>
                <div className="text-2xs text-text-secondary mt-0.5">
                  Shift A logged 0 open criticals to Shift B supervisor.
                </div>
              </div>
            </div>
            <span className="text-2xs text-text-secondary shrink-0">4h ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}
