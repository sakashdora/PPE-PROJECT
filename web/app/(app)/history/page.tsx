"use client";

import React, { useState } from "react";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import { selectHistory } from "@/features/alerts/selectors";
import { SeverityBadge } from "@/components/SeverityBadge";
import { AlertDrawer } from "@/features/alerts/AlertDrawer";
import { Severity, Status } from "@/lib/types";
import { DICTIONARY } from "@/lib/i18n";
import {
  FileText,
  Download,
  Search,
  Filter,
  Eye,
  CheckCircle,
  Calendar,
} from "lucide-react";

export default function HistoryPage() {
  const byId = useAlertsStore((s) => s.byId);
  const selectedAlertId = useAlertsStore((s) => s.selectedAlertId);
  const setSelectedAlertId = useAlertsStore((s) => s.setSelectedAlertId);
  const locale = useAlertsStore((s) => s.locale);
  const t = DICTIONARY[locale];

  const history = selectHistory(byId);

  const [search, setSearch] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [shiftFilter, setShiftFilter] = useState<string>("ALL");

  const filteredHistory = history.filter((a) => {
    if (severityFilter !== "ALL" && a.severity !== severityFilter) return false;
    if (statusFilter !== "ALL" && a.status !== statusFilter) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const mSector = a.sector.toLowerCase().includes(q);
      const mCam = a.cameraId.toLowerCase().includes(q);
      const mItems = a.items.some((i) => i.toLowerCase().includes(q));
      const mNote = a.note?.toLowerCase().includes(q) || false;
      if (!mSector && !mCam && !mItems && !mNote) return false;
    }

    return true;
  });

  const exportCSV = () => {
    const headers = [
      "Alert ID",
      "Timestamp",
      "Sector",
      "Camera ID",
      "Severity",
      "Violation Type",
      "Items",
      "Confidence",
      "Votes",
      "Status",
      "Acknowledged By",
      "Notes",
    ];

    const rows = filteredHistory.map((a) => [
      a.id,
      new Date(a.ts).toISOString(),
      `"${a.sector}"`,
      a.cameraId,
      a.severity,
      a.type,
      `"${a.items.join(", ")}"`,
      a.confidence.toFixed(2),
      a.votes,
      a.status,
      `"${a.ackBy || ""}"`,
      `"${(a.note || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `safety_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedAlert = selectedAlertId ? byId[selectedAlertId] || null : null;

  return (
    <div className="space-y-6">
      {/* Header and Export Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-industrial-800">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-sky-400" />
            <span>{t.history} & Compliance Log</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Immutable audit record of all industrial hazards, PPE violations, and supervisor corrections
          </p>
        </div>

        <button
          type="button"
          onClick={exportCSV}
          className="px-4 py-2 bg-industrial-800 hover:bg-industrial-700 text-slate-200 border border-industrial-600 rounded-lg text-xs font-mono font-bold flex items-center gap-2 shadow transition-all hover:text-white"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>{t.exportCsv}</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-industrial-900 p-4 rounded-xl border border-industrial-800">
        {/* Search */}
        <div>
          <label htmlFor="history-search-input" className="block text-2xs font-mono text-slate-400 mb-1">Search Keywords:</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              id="history-search-input"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sector, item, note..."
              className="w-full pl-8 pr-2.5 py-1.5 bg-industrial-950 border border-industrial-700 rounded text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Severity Filter */}
        <div>
          <label htmlFor="history-severity-select" className="block text-2xs font-mono text-slate-400 mb-1">Severity:</label>
          <select
            id="history-severity-select"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-industrial-950 border border-industrial-700 rounded text-xs text-white font-mono focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical (Fire/Smoke)</option>
            <option value="WARNING">Warning (Smoking)</option>
            <option value="COMPLIANCE">Compliance (PPE)</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label htmlFor="history-status-select" className="block text-2xs font-mono text-slate-400 mb-1">Status:</label>
          <select
            id="history-status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-industrial-950 border border-industrial-700 rounded text-xs text-white font-mono focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
            <option value="false_alarm">False Alarm</option>
          </select>
        </div>

        {/* Shift Filter */}
        <div>
          <label htmlFor="history-shift-select" className="block text-2xs font-mono text-slate-400 mb-1">Shift:</label>
          <select
            id="history-shift-select"
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-industrial-950 border border-industrial-700 rounded text-xs text-white font-mono focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Shifts</option>
            <option value="SHIFT_A">Shift A (06:00 - 14:00)</option>
            <option value="SHIFT_B">Shift B (14:00 - 22:00)</option>
            <option value="SHIFT_C">Shift C (22:00 - 06:00)</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-industrial-950/80 text-slate-400 uppercase tracking-wider border-b border-industrial-800">
              <tr>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Violation Item</th>
                <th className="py-3 px-4">Sector & Camera</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Supervisor Action</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-800/60 text-slate-300">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No matching compliance logs found.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((alert) => (
                  <tr
                    key={alert.id}
                    className="hover:bg-industrial-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <SeverityBadge severity={alert.severity} />
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      {alert.type === "missing_ppe"
                        ? `Missing ${alert.items.join(", ")}`
                        : alert.items.join(", ")}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-white truncate max-w-[160px]">
                        {alert.sector}
                      </div>
                      <div className="text-3xs text-slate-500">
                        {alert.cameraId.toUpperCase()}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-emerald-400 font-bold">
                        {(alert.confidence * 100).toFixed(0)}%
                      </span>
                      <span className="text-3xs text-slate-500 ml-1">
                        ({alert.votes})
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(alert.ts).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-3xs font-bold uppercase ${
                          alert.status === "open"
                            ? "bg-red-950 text-red-300 border border-red-800"
                            : alert.status === "acknowledged"
                            ? "bg-amber-950 text-amber-300 border border-amber-800"
                            : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                        }`}
                      >
                        {alert.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-300">
                      {alert.note || <span className="text-slate-600 italic">None logged</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedAlertId(alert.id)}
                        className="p-1.5 bg-industrial-800 hover:bg-industrial-700 text-slate-300 hover:text-white rounded border border-industrial-700 transition-colors"
                        title="View Full Incident Dossier"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Inspection Drawer */}
      <AlertDrawer
        alert={selectedAlert}
        onClose={() => setSelectedAlertId(null)}
      />
    </div>
  );
}
