"use client";

import React from "react";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import { Server, Wifi, WifiOff, Cpu, CheckCircle2 } from "lucide-react";

export const StatusFooter: React.FC = () => {
  const conn = useAlertsStore((s) => s.conn);
  const byId = useAlertsStore((s) => s.byId);

  const lastEvent = Object.values(byId)
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())[0];

  const lastEventTime = lastEvent
    ? new Date(lastEvent.ts).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "—";

  const isLive = conn === "live";

  return (
    <footer
      className="h-[30px] flex items-center justify-between px-4
                 bg-industrial-950/95 border-t border-industrial-800 text-2xs font-mono"
    >
      {/* Left: WebSocket & stream stats */}
      <div className="flex items-center gap-4 text-slate-400">
        <div className="flex items-center gap-1.5">
          {isLive ? (
            <Wifi className="w-3 h-3 text-emerald-400" />
          ) : (
            <WifiOff className="w-3 h-3 text-red-400" />
          )}
          <span className="text-slate-300 font-medium">WebSocket</span>
          <span
            className={`flex items-center gap-1 ${
              isLive ? "text-emerald-400" : "text-red-400"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isLive ? "bg-emerald-400 animate-status-pulse" : "bg-red-400"
              }`}
            />
            {isLive ? "Connected" : conn === "reconnecting" ? "Reconnecting…" : "Disconnected"}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1 text-slate-500">
          <span className="text-slate-400">Last event:</span>
          <span className="text-slate-300">{lastEventTime}</span>
        </div>

        <div className="hidden md:flex items-center gap-1 text-slate-500">
          <span className="text-slate-400">4 cameras</span>
        </div>

        <div className="hidden md:flex items-center gap-1 text-slate-500">
          <span className="text-slate-400">0 dropped</span>
        </div>
      </div>

      {/* Right: Edge nodes + model + health */}
      <div className="flex items-center gap-4 text-slate-400">
        <div className="hidden sm:flex items-center gap-1.5">
          <Server className="w-3 h-3 text-slate-500" />
          <span className="text-slate-400">Edge Nodes:</span>
          <span className="text-emerald-400 font-medium">4/4</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Online
          </span>
        </div>

        <div className="hidden md:flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-slate-500" />
          <span className="text-slate-400">Model:</span>
          <span className="text-sky-300 font-medium">ppe_v2</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">v1.2.4</span>
        </div>

        <div className="flex items-center gap-1.5 text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          <span className="font-medium">System Healthy</span>
        </div>
      </div>
    </footer>
  );
};
