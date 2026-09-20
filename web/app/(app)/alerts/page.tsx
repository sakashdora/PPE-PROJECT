"use client";

import React, { useState } from "react";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import { selectQueue, selectHistory } from "@/features/alerts/selectors";
import { AlertCard } from "@/features/alerts/AlertCard";
import { AlertDrawer } from "@/features/alerts/AlertDrawer";
import { Severity } from "@/lib/types";
import { DICTIONARY } from "@/lib/i18n";
import {
  AlertTriangle,
  Flame,
  CigaretteOff,
  HardHat,
  Search,
  Filter,
  CheckCircle2,
} from "lucide-react";

export default function AlertsPage() {
  const byId = useAlertsStore((s) => s.byId);
  const selectedAlertId = useAlertsStore((s) => s.selectedAlertId);
  const setSelectedAlertId = useAlertsStore((s) => s.setSelectedAlertId);
  const locale = useAlertsStore((s) => s.locale);
  const t = DICTIONARY[locale];

  const [activeTab, setActiveTab] = useState<"ALL" | Severity | "RESOLVED">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const queue = selectQueue(byId);
  const history = selectHistory(byId);

  const selectedAlert = selectedAlertId ? byId[selectedAlertId] || null : null;

  // Filter list based on selected tab and search term
  const filteredAlerts = (activeTab === "RESOLVED" ? history : queue).filter((alert) => {
    // Tab filter
    if (activeTab === "RESOLVED") {
      if (alert.status !== "resolved" && alert.status !== "false_alarm") return false;
    } else if (activeTab !== "ALL") {
      if (alert.severity !== activeTab) return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSector = alert.sector.toLowerCase().includes(q);
      const matchCam = alert.cameraId.toLowerCase().includes(q);
      const matchType = alert.type.toLowerCase().includes(q);
      const matchItems = alert.items.some((i) => i.toLowerCase().includes(q));
      if (!matchSector && !matchCam && !matchType && !matchItems) return false;
    }

    return true;
  });

  const criticalCount = queue.filter((a) => a.severity === "CRITICAL").length;
  const warningCount = queue.filter((a) => a.severity === "WARNING").length;
  const complianceCount = queue.filter((a) => a.severity === "COMPLIANCE").length;
  const resolvedCount = history.filter(
    (a) => a.status === "resolved" || a.status === "false_alarm"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header and Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-industrial-800">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <span>{t.alertQueue} — Active Incident Triage</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Strict priority ordering: Critical (Fire/Smoke) &gt; Warning (Smoking) &gt; Compliance (PPE)
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by sector, camera, item..."
            className="w-full pl-9 pr-3 py-2 bg-industrial-900 border border-industrial-700 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("ALL")}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
            activeTab === "ALL"
              ? "bg-industrial-700 text-white shadow"
              : "bg-industrial-900 text-slate-400 hover:text-white"
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>ALL OPEN</span>
          <span className="ml-1 px-1.5 py-0.2 rounded bg-industrial-800 text-2xs">
            {queue.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("CRITICAL")}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
            activeTab === "CRITICAL"
              ? "bg-red-600 text-white shadow-lg shadow-red-950"
              : "bg-industrial-900 text-red-400 hover:bg-red-950/40"
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>CRITICAL</span>
          <span className="ml-1 px-1.5 py-0.2 rounded bg-black/40 text-2xs font-mono">
            {criticalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("WARNING")}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
            activeTab === "WARNING"
              ? "bg-amber-500 text-black shadow-lg"
              : "bg-industrial-900 text-amber-400 hover:bg-amber-950/40"
          }`}
        >
          <CigaretteOff className="w-3.5 h-3.5" />
          <span>WARNING</span>
          <span className="ml-1 px-1.5 py-0.2 rounded bg-black/40 text-2xs font-mono">
            {warningCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("COMPLIANCE")}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
            activeTab === "COMPLIANCE"
              ? "bg-slate-700 text-white shadow"
              : "bg-industrial-900 text-slate-300 hover:bg-industrial-800"
          }`}
        >
          <HardHat className="w-3.5 h-3.5" />
          <span>COMPLIANCE</span>
          <span className="ml-1 px-1.5 py-0.2 rounded bg-black/40 text-2xs font-mono">
            {complianceCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RESOLVED")}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
            activeTab === "RESOLVED"
              ? "bg-emerald-700 text-white shadow"
              : "bg-industrial-900 text-emerald-400 hover:bg-emerald-950/40"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>RESOLVED</span>
          <span className="ml-1 px-1.5 py-0.2 rounded bg-black/40 text-2xs font-mono">
            {resolvedCount}
          </span>
        </button>
      </div>

      {/* Alert Cards List */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className="p-12 text-center bg-industrial-900/60 border border-industrial-800 rounded-xl">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-industrial-800 border border-industrial-700 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-base font-bold text-white">No alerts found</h3>
            <p className="text-xs text-slate-400 font-mono mt-1">
              All monitored cameras and sectors are within compliance standards.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onInspect={(id) => setSelectedAlertId(id)}
            />
          ))
        )}
      </div>

      {/* Slide-out Inspection Drawer */}
      <AlertDrawer
        alert={selectedAlert}
        onClose={() => setSelectedAlertId(null)}
      />
    </div>
  );
}
