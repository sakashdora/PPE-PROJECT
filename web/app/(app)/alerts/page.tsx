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
    if (activeTab === "RESOLVED") {
      if (alert.status !== "resolved" && alert.status !== "false_alarm") return false;
    } else if (activeTab !== "ALL") {
      if (alert.severity !== activeTab) return false;
    }

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
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold font-display text-text-primary flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 text-copper" />
            <span>{t.alertQueue} — Active Incident Triage</span>
          </h1>
          <p className="text-xs text-text-secondary font-mono mt-0.5">
            Strict priority ordering: Critical (Fire/Smoke) &gt; Warning (Smoking/Ignition) &gt; Compliance (PPE)
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by sector, camera, item..."
            className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-sm text-xs font-mono text-text-primary placeholder-text-secondary focus:outline-none focus:border-copper transition-colors"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("ALL")}
          className={`px-3 py-1.5 rounded-sm text-xs font-mono font-medium flex items-center gap-1.5 transition-colors border ${
            activeTab === "ALL"
              ? "bg-copper text-base border-copper font-bold"
              : "bg-surface text-text-secondary border-border hover:text-text-primary hover:bg-elevated"
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>ALL OPEN</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-sm bg-base border border-border text-[9px] text-text-primary">
            {queue.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("CRITICAL")}
          className={`px-3 py-1.5 rounded-sm text-xs font-mono font-medium flex items-center gap-1.5 transition-colors border ${
            activeTab === "CRITICAL"
              ? "bg-critical text-text-primary border-critical font-bold"
              : "bg-surface text-critical border-border hover:border-critical/50 hover:bg-critical/10"
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>CRITICAL</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-sm bg-base border border-critical text-[9px] text-text-primary">
            {criticalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("WARNING")}
          className={`px-3 py-1.5 rounded-sm text-xs font-mono font-medium flex items-center gap-1.5 transition-colors border ${
            activeTab === "WARNING"
              ? "bg-warning text-base border-warning font-bold"
              : "bg-surface text-warning border-border hover:border-warning/50 hover:bg-warning/10"
          }`}
        >
          <CigaretteOff className="w-3.5 h-3.5" />
          <span>WARNING</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-sm bg-base border border-warning text-[9px] text-warning">
            {warningCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("COMPLIANCE")}
          className={`px-3 py-1.5 rounded-sm text-xs font-mono font-medium flex items-center gap-1.5 transition-colors border ${
            activeTab === "COMPLIANCE"
              ? "bg-warning text-base border-warning font-bold"
              : "bg-surface text-warning border-border hover:border-warning/50 hover:bg-warning/10"
          }`}
        >
          <HardHat className="w-3.5 h-3.5" />
          <span>COMPLIANCE</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-sm bg-base border border-border text-[9px] text-text-primary">
            {complianceCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RESOLVED")}
          className={`px-3 py-1.5 rounded-sm text-xs font-mono font-medium flex items-center gap-1.5 transition-colors border ${
            activeTab === "RESOLVED"
              ? "bg-safe text-text-primary border-safe font-bold"
              : "bg-surface text-safe border-border hover:border-safe/50 hover:bg-safe/10"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>RESOLVED</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-sm bg-base border border-safe text-[9px] text-safe">
            {resolvedCount}
          </span>
        </button>
      </div>

      {/* Alert Cards List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="p-12 text-center bg-surface border border-border rounded-sm">
            <div className="w-12 h-12 mx-auto mb-3 rounded-sm bg-base border border-border flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-safe" />
            </div>
            <h3 className="text-base font-bold font-display text-text-primary">
              No incidents in queue
            </h3>
            <p className="text-xs text-text-secondary font-mono mt-1">
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
