# Frontend Architecture: Supervisor Dashboard (`web/`)

**Companion to [PRD.md](file:///c:/hackthon-2/docs/PRD.md) (FR-5 to FR-15)**  
*Note: Code snippets are illustrative architectural starting points to be validated against server integration tests.*

---

## 1. Architectural Principles

1. **Internet Independence for Alarms:** The alarm path never depends on an active internet connection. The dashboard is served directly from the on-premise server inside the factory LAN (Dockerized, Next.js output: `standalone`). Vercel/cloud hosting is restricted to an optional read-only historical reporting portal.
2. **Critical First, Always Visible:** A sticky critical alarm banner and auditory alert controller exist at the root layout level. They render across all sub-routes and cannot be obscured or scrolled away.
3. **Live Data ≠ Cache Data:**
   - Server state (historical queries, camera config, zones) is managed by **TanStack Query**.
   - Ephemeral live alert streams are managed by a lightweight **Zustand** store fed by WebSocket.
   - Filter and view configurations are driven via URL search parameters.
4. **Degrade Loudly:** If the WebSocket connection drops, the UI immediately surfaces a prominent, persistent warning banner. A silent dashboard creates the dangerous illusion of a safe factory.
5. **Multimodal Accessibility:** Do not rely on color alone. Severity is communicated via: **Color + Icon + Text Label + Layout Position / Audio**.

---

## 2. Technology Stack

| Concern | Technology Choice | Rationale |
| :--- | :--- | :--- |
| **Framework** | **Next.js (App Router) + TypeScript** | Team standard; native Docker `standalone` output for low-footprint on-prem LAN deployment. |
| **Styling / UI** | **Tailwind CSS + shadcn/ui** | Fast iteration, high accessibility compliance, headless primitives. |
| **Server State** | **TanStack Query (React Query)** | Robust caching, background refetching, optimistic mutations for alert acknowledgments. |
| **Live State** | **Zustand** | Minimalist state store for fast live WebSocket alert streaming and connection health. |
| **Realtime** | **Native WebSocket (Custom Thin Client)** | Reconnection with exponential backoff, catch-up replay cursor, zero heavy library lock-in. |
| **Video Streams** | **MJPEG `<img>` Tiles (MVP) / WebRTC (v1)** | Edge worker encodes annotated frames directly; zero client-side hardware decoding overhead. |
| **Zone Editor** | **SVG Overlay (or Konva)** | Normalized coordinate system ($0.0 - 1.0$) invariant to camera resolution changes. |
| **Data Visualizations** | **Recharts** | Lightweight SVG trend charts for violations by sector and shift. |
| **Form Management** | **React Hook Form + Zod** | Type-safe form validation sharing schemas with backend APIs. |
| **Internationalization** | **`next-intl` (en / hi / or)** | Multilingual UI for factory shift supervisors (English, Hindi, Odia). |
| **Testing Suite** | **Vitest, Testing Library, Playwright** | Fast unit tests, component behavior tests, full offline mock WS E2E tests. |

> [!NOTE]  
> **Shared Types:** Export schemas from backend Zod/OpenAPI specifications to `packages/shared` or `@shared/types` to ensure uniform contract definitions across Edge, Backend, and Frontend.

---

## 3. Route Hierarchy (App Router)

```
/login                               # Supervisor & Admin authentication
/(app)                               # Authenticated layout: AppShell
  ├── layout.tsx                     # Nav, ConnectionBar, CriticalBanner, AlarmController
  ├── /wall                          # Live multi-stream video wall (Default route)
  ├── /alerts                        # Active alert queue + detail drawer
  ├── /history                       # Historical records, filters, CSV/PDF export
  ├── /reports                       # Analytical trends (violations per sector/shift)
  ├── /admin
  │     ├── /cameras                 # Camera stream ingestion & status
  │     ├── /zones/[cameraId]        # Interactive SVG polygon zone editor
  │     ├── /thresholds              # Confidence threshold & temporal voter tuning
  │     └── /users                   # Role-based user administration
  └── /health                        # Edge node telemetry, active model metrics (report.json)
```

### Role-Based Access Control (`middleware.ts`)
- **Viewer:** `/wall`, `/alerts` (read-only)
- **Supervisor:** Viewer permissions + `/alerts` (acknowledge/resolve), `/history`, `/reports`
- **Admin:** Full access including `/admin/*` and `/health`
- **Authentication:** JWT stored in `httpOnly` secure cookies. WebSockets authenticate using the same cookie handshake (no raw tokens in query strings).

---

## 4. Folder Structure

```
web/
├── app/
│   ├── (app)/
│   │   ├── layout.tsx               # AppShell (Nav, CriticalBanner, ConnectionBar)
│   │   ├── wall/page.tsx            # Multi-camera live grid
│   │   ├── alerts/page.tsx          # Real-time alert triage queue
│   │   ├── history/page.tsx         # Searchable violation logs
│   │   ├── reports/page.tsx         # Trend analytics
│   │   ├── admin/                   # Camera, zone, threshold config
│   │   └── health/page.tsx          # Edge node FPS, latency & model card
│   ├── login/page.tsx               # Authentication portal
│   └── api/                         # Thin BFF for cookie & auth translation
├── features/
│   ├── alerts/                      # AlertCard, AlertQueue, AlertDrawer, useAckAlert
│   │   ├── alerts.store.ts          # Zustand store for streamed events
│   │   └── selectors.ts             # Priority queue selectors
│   ├── wall/                        # StreamTile, StreamGrid, useVisibleStreams
│   ├── zones/                       # ZoneEditor, polygon.ts, useZones
│   ├── history/                     # HistoryTable, Filters, useHistoryQuery
│   └── health/                      # EdgeNodeCard, ModelCard
├── realtime/
│   ├── wsClient.ts                  # Native WS client, reconnection & watchdog
│   ├── RealtimeProvider.tsx         # WS lifecycle context
│   └── events.ts                    # Typed real-time event definitions
├── audio/
│   ├── AlarmController.tsx          # Looping siren audio & browser autoplay unlock
│   ├── alarm.mp3                    # Critical siren audio asset
│   └── ack.mp3                      # Acknowledgment audio chime
├── lib/
│   ├── api.ts                       # Fetch client wrapper with interceptors
│   ├── auth.ts                      # Session helpers
│   ├── time.ts                      # Server-aligned timestamps & relative time
│   ├── format.ts                    # String formatters
│   └── severity.ts                  # Design tokens & metadata for severities
├── components/
│   ├── ui/                          # shadcn/ui components (Dialog, Button, Slider)
│   ├── SeverityBadge.tsx            # Uniform severity tags
│   ├── ConnectionBar.tsx            # Reconnection & offline status bar
│   ├── CriticalBanner.tsx           # Pinned top critical violation notice
│   └── EmptyState.tsx               # Informational placeholder
├── i18n/
│   ├── en.json                      # English translations
│   ├── hi.json                      # Hindi translations
│   └── or.json                      # Odia translations
├── tests/
│   ├── unit/                        # Queue ordering & math tests
│   ├── e2e/                         # Playwright flows
│   ├── mocks/ws-server.ts           # Mock WS server simulating streams
│   └── scenarios/demo.json          # Demo scenario playback
└── next.config.ts                   # output: 'standalone'
```

---

## 5. State Model & Real-Time Data Flow

| State Scope | Storage Mechanism | Example Entities |
| :--- | :--- | :--- |
| **Live Alerts** | Zustand (`alerts.store.ts`) | Open alerts, unacknowledged critical queue, WS link health, catch-up cursor |
| **Server State** | TanStack Query | Historical alerts, camera catalog, zone coordinates, thresholds, reports |
| **UI & Filter State** | URL Search Parameters | Active sector filters, date bounds, selected alert drawer ID |
| **Local Preferences** | `localStorage` | Audio unlock state, grid layout preference (2×2 vs 3×3), selected locale |

### Data Flow Lifecycle
1. **Initial Mount:** REST call fetches open alerts to seed the Zustand store.
2. **WebSocket Handshake:** Connects with `?since=<cursor>` cursor timestamp.
3. **Catch-Up Synchronization:** Server replays any alerts missed during offline or reload intervals.
4. **Live Streaming:** Server pushes incremental events (`alert.created`, `alert.updated`).
5. **Optimistic Mutations:** Acknowledging an alert optimistically modifies the UI; backend confirmation ensures eventual consistency.

```typescript
// features/alerts/alerts.store.ts
import { create } from "zustand";

export type Severity = "CRITICAL" | "WARNING" | "COMPLIANCE";
export type Status = "open" | "acknowledged" | "resolved" | "false_alarm";

export interface Alert {
  id: string;
  ts: string;
  updatedAt: string;
  cameraId: string;
  sector: string;
  severity: Severity;
  type: string;
  items: string[];
  confidence: number;
  status: Status;
  snapshotUrl?: string;
}

type ConnStatus = "connecting" | "live" | "reconnecting" | "offline";

const RANK: Record<Severity, number> = {
  CRITICAL: 0,
  WARNING: 1,
  COMPLIANCE: 2,
};

interface AlertState {
  byId: Record<string, Alert>;
  cursor: string | null;
  conn: ConnStatus;
  upsert: (a: Alert) => void;
  seed: (list: Alert[]) => void;
  setConn: (c: ConnStatus) => void;
}

export const useAlerts = create<AlertState>((set) => ({
  byId: {},
  cursor: null,
  conn: "connecting",
  upsert: (a) =>
    set((s) => ({
      byId: { ...s.byId, [a.id]: a },
      cursor: !s.cursor || a.updatedAt > s.cursor ? a.updatedAt : s.cursor,
    })),
  seed: (list) =>
    set((s) => {
      const byId = { ...s.byId };
      let cursor = s.cursor;
      for (const a of list) {
        byId[a.id] = a;
        if (!cursor || a.updatedAt > cursor) cursor = a.updatedAt;
      }
      return { byId, cursor };
    }),
  setConn: (conn) => set({ conn }),
}));

// Selectors
export const selectQueue = (byId: Record<string, Alert>) =>
  Object.values(byId)
    .filter((a) => a.status === "open" || a.status === "acknowledged")
    .sort((a, b) => RANK[a.severity] - RANK[b.severity] || b.ts.localeCompare(a.ts));

export const selectUnackedCritical = (byId: Record<string, Alert>) =>
  Object.values(byId).filter((a) => a.severity === "CRITICAL" && a.status === "open");
```

### WebSocket Client (`realtime/wsClient.ts`)
```typescript
export function connectAlerts(opts: {
  url: string;
  getCursor: () => string | null;
  onEvent: (e: unknown) => void;
  onStatus: (s: "live" | "reconnecting" | "offline") => void;
}) {
  let ws: WebSocket | null = null;
  let tries = 0;
  let closed = false;
  let lastHeartbeat = Date.now();

  const open = () => {
    const since = opts.getCursor();
    const endpoint = since ? `${opts.url}?since=${encodeURIComponent(since)}` : opts.url;
    ws = new WebSocket(endpoint);

    ws.onopen = () => {
      tries = 0;
      lastHeartbeat = Date.now();
      opts.onStatus("live");
    };

    ws.onmessage = (m) => {
      lastHeartbeat = Date.now();
      try {
        opts.onEvent(JSON.parse(m.data));
      } catch (err) {
        console.error("Failed to parse realtime event payload", err);
      }
    };

    ws.onerror = () => ws?.close();

    ws.onclose = () => {
      if (closed) return;
      opts.onStatus("reconnecting");
      const delay = Math.min(1000 * 2 ** tries++, 10_000);
      setTimeout(open, delay);
    };
  };

  // Watchdog: Server pings every 5s; 15s silence implies a broken TCP socket
  const watchdog = setInterval(() => {
    if (Date.now() - lastHeartbeat > 15_000) {
      ws?.close();
    }
  }, 5_000);

  open();

  return () => {
    closed = true;
    clearInterval(watchdog);
    ws?.close();
  };
}
```

---

## 6. Critical Audio Alarms: Browser Autoplay Policy

Modern browsers strictly block unprompted audio autoplay until user interaction occurs.

1. **Audio Unlock Gate:** On initial session entry, display a persistent modal/banner: *"Click to Enable Alarm Sound"*. Once clicked, audio context is unlocked for the session.
2. **Looping Critical Siren:** `AlarmController.tsx` evaluates `selectUnackedCritical()`. If `> 0`, it triggers a looping siren (`alarm.mp3`).
3. **Acknowledgment Behavior:** Acknowledging an active critical alert silences the siren immediately. However, the alert remains pinned to the top of the queue until marked `resolved` (PRD FR-7).
4. **Multimodal Fallbacks:**
   - Sticky red top banner pulses across every screen.
   - Browser title alternates dynamically: `🔥 FIRE [Sector 4] — Safety AI`.
   - Browser favicon dynamically switches to red alert indicator.
   - The primary physical alarm relay is driven directly by the edge worker; browser audio acts as an auxiliary notification.

---

## 7. Video Wall Implementation (`/wall`)

- **Low-Latency Streaming:** Each `StreamTile` embeds an MJPEG stream: `<img src="{edgeBase}/stream/{cameraId}.mjpg" />`.
- **Resource Conservation:**
  - Uses `IntersectionObserver` to unmount or pause MJPEG feeds that are scrolled out of viewport.
  - Automatically unmounts stream streams when `document.hidden` is true to conserve LAN bandwidth and supervisor machine CPU.
- **Visual Alert States:**
  - **Live:** Green pulse status indicator with stream FPS.
  - **Stalled:** Gray overlay: *"Stream Stalled (No frames in 5s)"*.
  - **Critical Alert:** Flashing thick red border; automatically pins stream to top-left slot; click opens Alert Drawer with live telemetry and snapshot.
- **Layout Presets:** Grid layouts (1×1 single camera, 2×2 quad, 3×3, 4×4) persisted in `localStorage`.

---

## 8. Key Screens & Component Mapping

| Screen Route | Key Components | Responsibilities |
| :--- | :--- | :--- |
| `/wall` | `StreamGrid`, `StreamTile`, `CriticalBanner`, `MiniAlertQueue` | Live grid observation, immediate visual feedback on hazards. |
| `/alerts` | `AlertQueue`, `AlertCard`, `AlertDrawer`, `AckModal` | Virtualized alert queue sorted by severity; detailed inspection with bounding boxes, snapshot, and supervisor notes. |
| `/history` | `HistoryFilters`, `HistoryTable`, `ExportButton` | Query historical violations with sector, shift, and date filters; CSV/PDF generation. |
| `/admin/zones/[cameraId]` | `ZoneEditor`, `SvgOverlay`, `PolygonHandle` | Draw and persist polygon boundaries for restricted smoking or PPE required zones. |
| `/admin/thresholds` | `ThresholdSlider`, `MetricComparisonCard` | Fine-tune confidence thresholds with real-time warnings (*"Lowering fire threshold increases false positives"*). |
| `/health` | `EdgeNodeCard`, `ModelMetricCard` | Telemetry for CPU/GPU, FPS per stream, active model metadata from `report.json`. |

### Severity Design Tokens (`lib/severity.ts`)
```typescript
export const SEVERITY = {
  CRITICAL: {
    label: "CRITICAL",
    icon: "Flame",
    bgClass: "bg-red-600",
    textClass: "text-white",
    borderClass: "border-red-500",
    sticky: true,
  },
  WARNING: {
    label: "WARNING",
    icon: "CigaretteOff",
    bgClass: "bg-amber-500",
    textClass: "text-black",
    borderClass: "border-amber-400",
    sticky: false,
  },
  COMPLIANCE: {
    label: "COMPLIANCE",
    icon: "HardHat",
    bgClass: "bg-slate-600",
    textClass: "text-white",
    borderClass: "border-slate-400",
    sticky: false,
  },
} as const;
```

---

## 9. Performance, Resilience, & Security

- **Latency Budget:** Time from WebSocket message reception to DOM alert rendering must be $\le 50\text{ ms}$; end-to-end frame-to-alert target $\le 1\text{ s}$.
- **Backpressure & Coalescing:** Batch high-frequency `COMPLIANCE` alerts via `requestAnimationFrame` coalescing to prevent UI thread starvation. `CRITICAL` alerts bypass batching for instantaneous rendering.
- **LAN-First Offline Resilience:** If the backend becomes unreachable, display a top-level notice: *"SYSTEM DISCONNECTED — Showing last cached state"*. Disable state mutations while socket reconnects.
- **Time Calibration:** Timestamps displayed relative to server clock offsets, avoiding inaccurate client clocks.
- **Security & Privacy:**
  - Content Security Policy (CSP) restricted to on-prem LAN hostnames for `img-src` and `connect-src`.
  - Alert snapshots accessible only via authenticated session routes with optional edge face-blurring.

---

## 10. Testing Strategy

1. **Unit Tests (Vitest):**
   - Severity rank ordering in `selectQueue`.
   - Identification of unacknowledged critical alerts in `selectUnackedCritical`.
   - Coordinate normalization math for polygon zone boundaries.
2. **Component Tests (React Testing Library):**
   - Verification of `AlertCard` acknowledgment triggers.
   - Behavior of `ConnectionBar` across connection states.
   - Audio unlock gate interaction.
3. **Mock WebSocket Server (`tests/mocks/ws-server.ts`):**
   - Replays deterministic demo script (`scenarios/demo.json`) covering: missing helmet $\to$ yellow shirt negative test $\to$ fire alert $\to$ socket interruption $\to$ catch-up sync.
4. **End-to-End Tests (Playwright):**
   - Full operator workflow: Login $\to$ enable audio $\to$ receive critical alert $\to$ verify siren loop $\to$ acknowledge $\to$ resolve.

---

## 11. Build, Packaging, & Deployment

- **Containerization:** Built using Next.js standalone output:
  ```dockerfile
  # web/Dockerfile
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  FROM node:20-alpine AS runner
  WORKDIR /app
  ENV NODE_ENV=production
  COPY --from=builder /app/public ./public
  COPY --from=builder /app/.next/standalone ./
  COPY --from=builder /app/.next/static ./.next/static
  EXPOSE 3000
  CMD ["node", "server.js"]
  ```
- **Environment Configuration:**
  - `NEXT_PUBLIC_API_URL`: On-prem backend HTTP API endpoint.
  - `NEXT_PUBLIC_WS_URL`: On-prem backend WebSocket gateway.
  - `NEXT_PUBLIC_EDGE_STREAM_BASE`: Edge worker MJPEG streaming server.

---

## 12. Implementation Phasing

1. **Phase 1: Foundations:** Setup Next.js App Router, Tailwind/shadcn tokens, AppShell, `ConnectionBar`, `alerts.store.ts`, and Mock WS test harness.
2. **Phase 2: Alert Engine:** Implement `AlertQueue`, `AlertCard`, acknowledgment mutations, `CriticalBanner`, and `AlarmController` audio unlock gate.
3. **Phase 3: Live Video Wall:** Build `StreamGrid` and `StreamTile` with MJPEG auto-mount, stall detection, and critical red border highlights.
4. **Phase 4: History & Analytics:** Implement searchable `HistoryTable`, filtering controls, and CSV export.
5. **Phase 5: Administration:** Build SVG `ZoneEditor` and confidence threshold sliders with risk warnings.
6. **Phase 6: Health & Verification:** Implement edge node health telemetry cards, multilingual translations (en, hi, or), and Playwright demo scenario validation.
