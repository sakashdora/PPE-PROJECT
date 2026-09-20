"use client";

import React from "react";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import { DICTIONARY } from "@/lib/i18n";
import { WifiOff, RefreshCw, AlertTriangle } from "lucide-react";

export const ConnectionBar: React.FC = () => {
  const conn = useAlertsStore((s) => s.conn);
  const disconnectedAt = useAlertsStore((s) => s.disconnectedAt);
  const locale = useAlertsStore((s) => s.locale);
  const t = DICTIONARY[locale];

  if (conn === "live") return null;

  const isReconnecting = conn === "reconnecting";

  return (
    <div
      role="alert"
      className={`w-full py-2.5 px-4 text-xs font-mono font-semibold flex items-center justify-between border-b shadow-lg transition-all ${
        isReconnecting
          ? "bg-amber-950/95 border-amber-600 text-amber-200"
          : "bg-red-950/95 border-red-600 text-red-200"
      }`}
    >
      <div className="flex items-center gap-3">
        {isReconnecting ? (
          <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
        ) : (
          <WifiOff className="w-4 h-4 text-red-400" />
        )}
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-wider">
            {isReconnecting ? t.systemReconnecting : t.systemOffline}
          </span>
          {disconnectedAt && (
            <span className="opacity-80">
              ({t.disconnectedSince} {disconnectedAt})
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-2xs bg-black/40 px-2.5 py-1 rounded border border-white/10">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        <span>LOCAL CACHE ACTIVE — BUFFERED ALERTS WILL SYNC ON RECONNECT</span>
      </div>
    </div>
  );
};
