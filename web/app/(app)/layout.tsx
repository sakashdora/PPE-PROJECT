"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { ConnectionBar } from "@/components/ConnectionBar";
import { CriticalBanner } from "@/components/CriticalBanner";
import { StatusFooter } from "@/components/StatusFooter";
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
    <div className="flex flex-col h-screen overflow-hidden bg-industrial-950 text-slate-100">
      {/* Audio Autoplay Modal (portal, does not affect layout) */}
      <AudioUnlockGateModal />

      {/* Fixed top chrome: ConnectionBar (if degraded) + Navbar + CriticalBanner */}
      <div className="flex-none">
        <ConnectionBar />
        <Navbar />
        <CriticalBanner />
      </div>

      {/* Main content — full screen for /wall, scrollable max-w-7xl for others */}
      {isWallPage ? (
        <main className="flex-1 min-h-0 overflow-hidden">
          {children}
        </main>
      ) : (
        <main className="flex-1 min-h-0 overflow-y-auto w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      )}

      {/* Fixed bottom chrome: Status bar */}
      <div className="flex-none">
        <StatusFooter />
      </div>
    </div>
  );
}
