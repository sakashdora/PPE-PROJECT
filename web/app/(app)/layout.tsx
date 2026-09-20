"use client";

import React, { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { ConnectionBar } from "@/components/ConnectionBar";
import { CriticalBanner } from "@/components/CriticalBanner";
import { AudioUnlockGateModal } from "@/components/AlarmController";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import { connectAlerts } from "@/realtime/wsClient";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const upsert = useAlertsStore((s) => s.upsert);
  const setConn = useAlertsStore((s) => s.setConn);
  const setSeq = useAlertsStore((s) => s.setSeq);

  // If a real WebSocket URL is configured, attach connection
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) return;

    const ws = connectAlerts({
      url: wsUrl,
      // Cursor is an integer seq for gapless replay (?since=<seq>)
      getCursor: () => useAlertsStore.getState().cursor,
      onAlert: (alert) => upsert(alert),
      onStatus: (status) => setConn(status),
      onSeq: (seq) => setSeq(seq),
    });

    return () => ws.disconnect();
  }, [upsert, setConn, setSeq]);

  return (
    <div className="flex flex-col min-h-screen bg-industrial-950 text-slate-100">
      {/* 1. Offline or Degraded Connection Notice */}
      <ConnectionBar />

      {/* 2. Top-level Sticky Critical Emergency Banner */}
      <CriticalBanner />

      {/* 3. Audio Autoplay Policy Unlock Modal (if not yet interacted) */}
      <AudioUnlockGateModal />

      {/* 4. Top Industrial Navigation Header */}
      <Navbar />

      {/* 5. Main Route View */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
