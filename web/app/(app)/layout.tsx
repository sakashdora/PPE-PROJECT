"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import { TopStatusStrip } from "@/components/TopStatusStrip";
import { BottomDock } from "@/components/BottomDock";
import { AudioUnlockGateModal } from "@/components/AlarmController";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import { connectAlerts } from "@/realtime/wsClient";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isWallPage = pathname === "/wall";

  const upsert = useAlertsStore((s) => s.upsert);
  const setConn = useAlertsStore((s) => s.setConn);
  const setSeq = useAlertsStore((s) => s.setSeq);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) return;
    const ws = connectAlerts({
      url: wsUrl,
      getCursor: () => useAlertsStore.getState().cursor,
      onAlert: (alert) => upsert(alert),
      onStatus: (status) => setConn(status),
      onSeq: (seq) => setSeq(seq),
    });
    return () => ws.disconnect();
  }, [upsert, setConn, setSeq]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-base text-text-primary font-sans">
      {/* Audio Autoplay Modal (portal) */}
      <AudioUnlockGateModal />

      {/* Unified Single-line Top Status Strip */}
      <TopStatusStrip />

      {/* Main Content Area */}
      {isWallPage ? (
        <main className="flex-1 min-h-0 overflow-hidden pb-16">
          {children}
        </main>
      ) : (
        <main className="flex-1 min-h-0 overflow-y-auto w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 pb-24">
          {children}
        </main>
      )}

      {/* Floating Bottom Dock (Sanctioned backdrop-blur navigation) */}
      <BottomDock />
    </div>
  );
}
