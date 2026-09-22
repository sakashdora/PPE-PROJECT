import { Alert } from "@/lib/types";

export interface RealtimeEvent {
  seq: number; // sequential integer — used for gapless replay (?since=<seq>)
  type: "alert.created" | "alert.updated" | "camera.status" | "edge.health" | "ping" | "resync";
  data: unknown;
}

export function connectAlerts(opts: {
  url: string;
  /**
   * Returns the last received integer seq (NOT an ISO date string).
   * The WS gateway accepts ?since=<seq> where seq is a BigInt-safe integer.
   * Return null or 0 to replay from the beginning.
   */
  getCursor: () => number | null;
  onAlert: (alert: Alert) => void;
  onStatus: (status: "live" | "reconnecting" | "offline") => void;
  onSeq?: (seq: number) => void;  // called whenever a new seq is received
  onHealth?: (health: unknown) => void;
}) {
  let ws: WebSocket | null = null;
  let retryCount = 0;
  let isClosed = false;
  let lastMessageAt = Date.now();
  let reconnectTimer: NodeJS.Timeout | null = null;

  const open = () => {
    try {
      const cursor = opts.getCursor();
      const endpoint = cursor ? `${opts.url}?since=${encodeURIComponent(cursor)}` : opts.url;
      ws = new WebSocket(endpoint);

      ws.onopen = () => {
        retryCount = 0;
        lastMessageAt = Date.now();
        opts.onStatus("live");
      };

      ws.onmessage = (event) => {
        lastMessageAt = Date.now();
        try {
          const envelope: RealtimeEvent = JSON.parse(event.data);
          // Track highest seq for gapless replay cursor
          if (envelope.seq && envelope.seq > 0 && opts.onSeq) {
            opts.onSeq(envelope.seq);
          }
          if (envelope.type === "alert.created" || envelope.type === "alert.updated") {
            opts.onAlert(envelope.data as Alert);
          } else if (envelope.type === "resync") {
            // Server says we're too far behind — reset cursor and reconnect
            console.warn("[WS] Server resync request. Resetting cursor.");
            if (opts.onSeq) opts.onSeq(0);
          } else if (envelope.type === "edge.health" && opts.onHealth) {
            opts.onHealth(envelope.data);
          }
        } catch (err) {
          console.error("Error parsing WebSocket message", err);
        }
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onclose = () => {
        if (isClosed) return;
        retryCount++;
        if (retryCount === 1) {
          console.info(
            `[ARGUS Realtime] WebSocket gateway not reachable at ${opts.url}. Operating in local on-premise simulation mode.`
          );
        }
        opts.onStatus(retryCount > 2 ? "offline" : "reconnecting");
        // Calm exponential backoff: 2s -> 4s -> 8s -> 16s -> 30s
        const delay = Math.min(2000 * 2 ** (retryCount - 1), 30000);
        reconnectTimer = setTimeout(open, delay);
      };
    } catch {
      opts.onStatus("offline");
      reconnectTimer = setTimeout(open, 30000);
    }
  };

  // Watchdog timer: if no ping or message received within 15 seconds, trigger reconnect
  const watchdogTimer = setInterval(() => {
    if (Date.now() - lastMessageAt > 15000 && ws?.readyState === WebSocket.OPEN) {
      console.warn("Watchdog timeout (15s dead link). Forcing reconnect.");
      ws.close();
    }
  }, 5000);

  open();

  return {
    disconnect: () => {
      isClosed = true;
      clearInterval(watchdogTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}
