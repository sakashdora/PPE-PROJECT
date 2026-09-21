import { create } from "zustand";
import { Alert, ConnectionStatus } from "@/lib/types";
import { SupportedLocale } from "@/lib/i18n";
import { audioController } from "@/lib/audio";
import demoData from "@/scenarios/demo.json";

interface AlertState {
  byId: Record<string, Alert>;
  /** Last received integer seq from WS gateway — used for ?since=<seq> gapless replay */
  cursor: number | null;
  conn: ConnectionStatus;
  disconnectedAt: string | null;
  selectedAlertId: string | null;
  locale: SupportedLocale;
  audioUnlocked: boolean;
  demoNotice: string | null;

  // Actions
  upsert: (alert: Alert) => void;
  seed: (alerts: Alert[]) => void;
  setConn: (status: ConnectionStatus) => void;
  setSeq: (seq: number) => void;
  acknowledgeAlert: (id: string, ackBy?: string, note?: string) => void;
  resolveAlert: (id: string, note?: string) => void;
  markFalseAlarm: (id: string, note?: string) => void;
  setSelectedAlertId: (id: string | null) => void;
  setLocale: (locale: SupportedLocale) => void;
  setAudioUnlocked: (unlocked: boolean) => void;
  setDemoNotice: (msg: string | null) => void;
  resetDemoData: () => void;
}

export const useAlertsStore = create<AlertState>((set, get) => ({
  byId: demoData.initialAlerts.reduce((acc, curr) => {
    acc[curr.id] = curr as unknown as Alert;
    return acc;
  }, {} as Record<string, Alert>),
  cursor: 0, // integer seq; 0 = replay everything from start
  conn: "live",
  disconnectedAt: null,
  selectedAlertId: null,
  locale: "en",
  audioUnlocked: false,
  demoNotice: null,

  upsert: (alert) => {
    const prevAlert = get().byId[alert.id];
    set((s) => ({
      byId: { ...s.byId, [alert.id]: alert },
      // cursor is managed via setSeq, not via alert timestamps
    }));

    // Trigger audio feedback based on severity
    if (!prevAlert && get().audioUnlocked) {
      if (alert.severity === "CRITICAL") {
        audioController.startSiren();
      } else if (alert.severity === "COMPLIANCE") {
        audioController.playCompliancePing();
      }
    }
  },

  setSeq: (seq: number) => {
    set((s) => ({ cursor: seq > (s.cursor ?? 0) ? seq : s.cursor }));
  },

  seed: (alerts) => {
    set((s) => {
      const byId = { ...s.byId };
      for (const a of alerts) {
        byId[a.id] = a;
      }
      // cursor (integer WS seq) is advanced only via setSeq() — never via timestamps
      return { byId };
    });
  },

  setConn: (status) => {
    set((s) => ({
      conn: status,
      disconnectedAt:
        status === "reconnecting" || status === "offline"
          ? s.disconnectedAt || new Date().toLocaleTimeString()
          : null,
    }));
  },

  acknowledgeAlert: (id, ackBy = "Shift Supervisor", note) => {
    const alert = get().byId[id];
    if (!alert) return;

    const updated: Alert = {
      ...alert,
      status: "acknowledged",
      ackBy,
      ackAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      note: note || alert.note,
    };

    set((s) => ({
      byId: { ...s.byId, [id]: updated },
    }));

    if (get().audioUnlocked) {
      audioController.playAckChime();
    }

    // Check if any other unacknowledged critical alert remains
    const otherUnackedCritical = Object.values(get().byId).filter(
      (a) => a.id !== id && a.severity === "CRITICAL" && a.status === "open"
    );
    if (otherUnackedCritical.length === 0) {
      audioController.stopSiren();
    }
  },

  resolveAlert: (id, note) => {
    const alert = get().byId[id];
    if (!alert) return;

    const updated: Alert = {
      ...alert,
      status: "resolved",
      resolvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      note: note || alert.note,
    };

    set((s) => ({
      byId: { ...s.byId, [id]: updated },
    }));

    // Check if siren needs silencing
    const anyUnackedCritical = Object.values(get().byId).filter(
      (a) => a.severity === "CRITICAL" && a.status === "open"
    );
    if (anyUnackedCritical.length === 0) {
      audioController.stopSiren();
    }
  },

  markFalseAlarm: (id, note) => {
    const alert = get().byId[id];
    if (!alert) return;

    const updated: Alert = {
      ...alert,
      status: "false_alarm",
      resolvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      note: note ? `[FALSE ALARM REPORT]: ${note}` : "[FALSE ALARM REPORT]",
    };

    set((s) => ({
      byId: { ...s.byId, [id]: updated },
    }));

    const anyUnackedCritical = Object.values(get().byId).filter(
      (a) => a.severity === "CRITICAL" && a.status === "open"
    );
    if (anyUnackedCritical.length === 0) {
      audioController.stopSiren();
    }
  },

  setSelectedAlertId: (id) => set({ selectedAlertId: id }),

  setLocale: (locale) => set({ locale }),

  setAudioUnlocked: (unlocked) => {
    set({ audioUnlocked: unlocked });
    if (unlocked) {
      audioController.unlock();
      // Check if unacknowledged critical alerts already exist
      const unacked = Object.values(get().byId).filter(
        (a) => a.severity === "CRITICAL" && a.status === "open"
      );
      if (unacked.length > 0) {
        audioController.startSiren();
      }
    } else {
      audioController.stopSiren();
    }
  },

  setDemoNotice: (demoNotice) => set({ demoNotice }),

  resetDemoData: () => {
    audioController.stopSiren();
    set({
      byId: demoData.initialAlerts.reduce((acc, curr) => {
        acc[curr.id] = curr as unknown as Alert;
        return acc;
      }, {} as Record<string, Alert>),
      cursor: 0, // integer WS seq — 0 means replay all events from start
      conn: "live",
      disconnectedAt: null,
      selectedAlertId: null,
      demoNotice: "Reset back to baseline factory state.",
    });
  },
}));
