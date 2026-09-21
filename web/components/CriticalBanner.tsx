"use client";

import React, { useEffect } from "react";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import { selectUnackedCritical } from "@/features/alerts/selectors";
import { DICTIONARY } from "@/lib/i18n";
import { AlertTriangle, ChevronRight } from "lucide-react";
import Link from "next/link";

export const CriticalBanner: React.FC = () => {
  const byId = useAlertsStore((s) => s.byId);
  const setSelectedAlertId = useAlertsStore((s) => s.setSelectedAlertId);
  const locale = useAlertsStore((s) => s.locale);
  const t = DICTIONARY[locale];

  const unackedCritical = selectUnackedCritical(byId);
  const activeCritical = unackedCritical[0];

  // Alternating browser tab title on critical alert
  useEffect(() => {
    if (!activeCritical) {
      document.title = "Industrial Safety AI — Supervisor Dashboard";
      return;
    }
    let toggle = false;
    const interval = setInterval(() => {
      toggle = !toggle;
      document.title = toggle
        ? `🔥 FIRE ALARM [${activeCritical.sector}]`
        : `⚠️ CRITICAL HAZARD ACTIVE`;
    }, 800);
    return () => {
      clearInterval(interval);
      document.title = "Industrial Safety AI — Supervisor Dashboard";
    };
  }, [activeCritical]);

  if (!activeCritical) return null;

  const items = activeCritical.items.join(" / ");
  const camId = activeCritical.cameraId.toUpperCase().replace("CAM-", "Camera ");
  const sector = activeCritical.sector;

  // Build a repeating ticker string for the scrolling effect
  const tickerText = `⚠ CRITICAL ALERT — ${items.toUpperCase()} Detected · ${camId} · ${sector} · ${(activeCritical.confidence * 100).toFixed(0)}% confidence`;
  const repeated = Array(6).fill(tickerText).join("    ·    ");

  return (
    <div
      aria-label="Critical Emergency Alert"
      className="w-full h-9 flex items-center justify-between
                 bg-red-700/95 border-b border-red-500/70 animate-siren-glow overflow-hidden"
    >
      {/* Left label */}
      <div className="flex items-center gap-2 px-3 shrink-0 border-r border-red-500/40 h-full bg-red-800/70">
        <AlertTriangle className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
        <span className="text-[11px] font-black font-mono tracking-widest text-yellow-200 uppercase whitespace-nowrap">
          CRITICAL ALERT
        </span>
      </div>

      {/* Scrolling ticker */}
      <div className="flex-1 overflow-hidden h-full flex items-center">
        <div className="flex animate-ticker whitespace-nowrap">
          <span className="text-[11px] font-mono font-semibold text-red-100 px-4 tracking-wide">
            {repeated}
          </span>
          <span className="text-[11px] font-mono font-semibold text-red-100 px-4 tracking-wide" aria-hidden>
            {repeated}
          </span>
        </div>
      </div>

      {/* View Details button */}
      <Link
        href="/alerts"
        onClick={() => setSelectedAlertId(activeCritical.id)}
        className="flex items-center gap-1.5 px-3 h-full shrink-0 border-l border-red-500/40
                   bg-red-800/60 hover:bg-red-700/80 text-yellow-200 hover:text-white
                   text-[11px] font-bold font-mono transition-colors"
      >
        <span>{t.viewStream || "View Details"}</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
};
