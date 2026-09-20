"use client";

import React, { useEffect } from "react";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import { selectUnackedCritical } from "@/features/alerts/selectors";
import { DICTIONARY } from "@/lib/i18n";
import { Flame, AlertOctagon, CheckCircle, Video } from "lucide-react";
import Link from "next/link";

export const CriticalBanner: React.FC = () => {
  const byId = useAlertsStore((s) => s.byId);
  const acknowledgeAlert = useAlertsStore((s) => s.acknowledgeAlert);
  const setSelectedAlertId = useAlertsStore((s) => s.setSelectedAlertId);
  const locale = useAlertsStore((s) => s.locale);
  const t = DICTIONARY[locale];

  const unackedCritical = selectUnackedCritical(byId);
  const activeCritical = unackedCritical[0];

  // Alternating browser tab title when a critical alert is unacknowledged
  useEffect(() => {
    if (!activeCritical) {
      document.title = "Factory Safety AI — Supervisor Dashboard";
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
      document.title = "Factory Safety AI — Supervisor Dashboard";
    };
  }, [activeCritical]);

  if (!activeCritical) return null;

  return (
    <aside
      aria-label="Critical Emergency Alert"
      className="sticky top-0 z-50 w-full bg-red-600 text-white shadow-2xl animate-siren-glow border-b-2 border-red-400"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-900/80 rounded-lg animate-bounce">
            <Flame className="w-6 h-6 text-yellow-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-black/40 text-yellow-300 px-2 py-0.5 rounded text-xs font-mono font-bold tracking-wider uppercase border border-yellow-400/40">
                CRITICAL HAZARD
              </span>
              <span className="font-mono text-xs text-red-200">
                {activeCritical.cameraId.toUpperCase()} · {activeCritical.sector}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-yellow-300 inline" />
              {activeCritical.type.toUpperCase()}: {activeCritical.items.join(" & ").toUpperCase()} DETECTED
              <span className="text-xs font-normal text-red-100 font-mono">
                (Conf: {(activeCritical.confidence * 100).toFixed(0)}% | Votes: {activeCritical.votes})
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/wall"
            onClick={() => setSelectedAlertId(activeCritical.id)}
            className="px-3 py-1.5 bg-black/40 hover:bg-black/60 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-all border border-white/20"
          >
            <Video className="w-4 h-4" />
            <span>{t.viewStream}</span>
          </Link>
          <button
            type="button"
            onClick={() => acknowledgeAlert(activeCritical.id, "Shift Supervisor (Direct Banner)")}
            className="px-4 py-2 bg-white text-red-700 hover:bg-yellow-300 hover:text-black rounded font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all transform active:scale-95"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{t.acknowledge} (Mute Siren)</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
