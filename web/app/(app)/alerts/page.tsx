"use client";

import React, { useState } from "react";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import { selectQueue, selectHistory } from "@/features/alerts/selectors";
import { AlertCard } from "@/features/alerts/AlertCard";
import { AlertDrawer } from "@/features/alerts/AlertDrawer";
import { Severity } from "@/lib/types";
import { DICTIONARY } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
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

  const TABS = [
    { id: "ALL", label: "ALL OPEN", icon: Filter, count: queue.length },
    { id: "CRITICAL", label: "CRITICAL", icon: Flame, count: criticalCount },
    { id: "WARNING", label: "WARNING", icon: CigaretteOff, count: warningCount },
    { id: "COMPLIANCE", label: "COMPLIANCE", icon: HardHat, count: complianceCount },
    { id: "RESOLVED", label: "RESOLVED", icon: CheckCircle2, count: resolvedCount },
  ] as const;

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
            className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-sm text-xs font-mono text-text-primary placeholder-text-secondary focus:outline-none focus:border-brand-accent transition-colors"
          />
        </div>
      </div>

      {/* Segmented Control Tabs */}
      <div className="flex flex-wrap items-center bg-base border border-border rounded-sm p-1 inline-flex self-start relative">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-sm text-xs font-mono transition-colors ${
                isActive ? "text-base font-bold" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeQueueTab"
                  className="absolute inset-0 bg-brand-accent rounded-sm z-[-1]"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-sm text-[9px] font-bold ${
                  isActive
                    ? "bg-base/20 text-base border border-base/10"
                    : "bg-elevated text-text-primary border border-border"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Alert Cards List with Collapse Transitions */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredAlerts.length === 0 ? (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="p-12 text-center bg-surface border border-border rounded-sm"
            >
              <div className="w-12 h-12 mx-auto mb-3 rounded-sm bg-base border border-border flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-safe" />
              </div>
              <h3 className="text-base font-bold font-display text-text-primary">
                No incidents in queue
              </h3>
              <p className="text-xs text-text-secondary font-mono mt-1">
                All monitored cameras and sectors are within compliance standards.
              </p>
            </motion.div>
          ) : (
            filteredAlerts.map((alert) => (
              <motion.div
                key={alert.id}
                layout
                initial={{ opacity: 0, scale: 0.98, height: 0 }}
                animate={{ opacity: 1, scale: 1, height: "auto" }}
                exit={{ opacity: 0, scale: 0.95, height: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                <AlertCard
                  alert={alert}
                  onInspect={(id) => setSelectedAlertId(id)}
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Slide-out Inspection Drawer */}
      <AlertDrawer
        alert={selectedAlert}
        onClose={() => setSelectedAlertId(null)}
      />
    </div>
  );
}
