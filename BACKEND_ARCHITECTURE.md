# Backend Architecture: On-prem Server + Edge Worker
Companion to PRD.md (§7-9) and FRONTEND_ARCHITECTURE.md.

## 1. Principles
- **The alarm path has no cloud or server dependency.** The edge worker triggers the physical alarm itself; the server is for visibility, workflow and history.
- **Never lose an alert.** Edge writes to a local outbox before sending; the server ingests idempotently.
- **A silent system must look broken.** Missing heartbeats and dead cameras are themselves alerts (dead-man's switch).
- **The server is simple on purpose.** One site, one Postgres, one API process. Complexity only where safety needs it (outbox, replay, compare-and-swap).
- **Pull, not push, toward the edge.** Edge fetches config and commands, so no inbound firewall rules on the camera network.

---

## 2. System Overview

```
[ Edge Worker (Python) ]
  ├── Reader threads: latest frame only (RTSP / Synthetic)
  ├── Inference loop: ONNX (models/best.onnx) / OpenVINO
  ├── Post-process: thresholds, person association, TemporalVoter, cooldown, zones
  ├── Physical Alarm: GPIO Relay / Buzzer (<10ms sync)
  ├── SQLite outbox (WAL mode)
  ├── Sender thread: retry + backoff
  ├── Config poller: GET /edge/config (ETag)
  ├── Heartbeat client: POST /edge/heartbeat (FPS, clearAlarms)
  └── MJPEG preview server: port 8080

      │ POST /edge/alerts (multipart + snapshot)
      │ POST /edge/heartbeat (telemetry + clearAlarms)
      │ GET /edge/config (hot-reload)
      ▼

[ On-prem Server (NestJS + Prisma + PostgreSQL) ]
  ├── Edge Ingestion Service: Idempotent ingest + Dedup safety net
  ├── State Machine: Compare-and-swap transitions (OPEN -> ACK -> RESOLVED / FALSE_ALARM)
  ├── Dead-man's Switch: Background monitor for missed heartbeats & dead cameras
  ├── WebSocket Gateway (@nestjs/platform-ws): Gapless replay via ?since=<seq> + live stream
  ├── REST API: Auth (Argon2 + JWT), Alerts, Cameras, Zones, Config, Reports CSV
  ├── Audit Log: Append-only log of logins, acks, config changes
  ├── In-process EventBus: Emits 'alert' after DB commit
  └── Scheduled Jobs: Retention cleanup, offline detector, backup

      ▲
      │ WebSocket (WS / WSS) + REST API
      ▼

[ Supervisor Dashboard (Next.js 15) ]
  ├── Live Video Wall (/wall) with edge MJPEG & audio siren
  ├── Priority Triage Queue (/alerts) with CAS acknowledge
  ├── Heatmap & Violation History (/history)
  ├── Compliance CSV Audit Reports (/reports)
  └── Camera, Zone & Threshold Administration (/admin/*)
```

---

## 3. Server (NestJS + Prisma + PostgreSQL)

### 3.1 Modules
| Module | Responsibility |
|---|---|
| **auth** | login, JWT in httpOnly cookie, roles guard (`VIEWER`, `SUPERVISOR`, `ADMIN`), login rate limit |
| **edge** | edge-node API-key guard, `POST /edge/alerts`, `POST /edge/heartbeat`, `GET /edge/config` |
| **alerts** | ingest, dedup safety net, state machine, query, snapshot serving |
| **realtime** | WebSocket gateway, replay + live stream, ping (uses `@nestjs/platform-ws` for native frontend WS) |
| **config** | cameras, sectors, zones, thresholds, voter params, model versions, config version counter |
| **reports** | aggregates and compliance CSV export |
| **health** | `/health/live`, `/health/ready`, offline detector, edge/camera status |
| **retention** | scheduled cleanup (snapshots, events), nightly DB backup trigger |
| **audit** | append-only log of logins, acks, config changes |

### 3.2 Data Model (Prisma)
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role        { VIEWER SUPERVISOR ADMIN }
enum Severity    { CRITICAL WARNING COMPLIANCE }
enum AlertStatus { OPEN ACKNOWLEDGED RESOLVED FALSE_ALARM }
enum ZoneKind    { SMOKING_RESTRICTED PPE_REQUIRED IGNORE }

model Site {
  id        String     @id @default(uuid())
  name      String
  sectors   Sector[]
  edgeNodes EdgeNode[]
}

model Sector {
  id      String   @id @default(uuid())
  siteId  String
  site    Site     @relation(fields: [siteId], references: [id])
  name    String
  cameras Camera[]
}

model EdgeNode {
  id         String    @id @default(uuid())
  siteId     String
  site       Site      @relation(fields: [siteId], references: [id])
  name       String
  apiKeyHash String
  lastSeenAt DateTime?
  fps        Float?
  latencyMs  Float?
  status     String    @default("unknown")
  cameras    Camera[]
}

model Camera {
  id           String    @id @default(uuid())
  sectorId     String
  sector       Sector    @relation(fields: [sectorId], references: [id])
  edgeNodeId   String
  edgeNode     EdgeNode  @relation(fields: [edgeNodeId], references: [id])
  name         String
  streamUrlEnc String    // AES-GCM encrypted, never sent to browser
  enabled      Boolean   @default(true)
  status       String    @default("unknown")
  lastFrameAt  DateTime?
  zones        Zone[]
  alerts       Alert[]
}

model Zone {
  id       String   @id @default(uuid())
  cameraId String
  camera   Camera   @relation(fields: [cameraId], references: [id])
  kind     ZoneKind
  polygon  Json     // [[x,y],...] normalised 0..1
}

model ModelVersion {
  id         String   @id @default(uuid())
  name       String   @unique
  metrics    Json
  thresholds Json
  active     Boolean  @default(false)
  createdAt  DateTime @default(now())
}

model ConfigState {
  id      Int  @id @default(1)
  version Int  @default(1)
  params  Json // voter params, cooldowns, shifts
}

model Alert {
  id           String      @id // UUID generated on the edge = idempotency key
  cameraId     String
  camera       Camera      @relation(fields: [cameraId], references: [id])
  dedupKey     String      // e.g. "helmet" or "fire"
  severity     Severity
  type         String
  items        String[]
  confidence   Float
  votes        String?
  hitCount     Int         @default(1)
  firstSeenAt  DateTime
  lastSeenAt   DateTime
  status       AlertStatus @default(OPEN)
  version      Int         @default(1) // compare-and-swap counter
  snapshotPath String?
  modelVersion String?
  ackById      String?
  ackAt        DateTime?
  note         String?

  @@index([status, severity, firstSeenAt])
  @@index([cameraId, dedupKey, lastSeenAt])
}

model AlertEvent { // append-only change log; drives WS replay
  seq       BigInt   @id @default(autoincrement())
  alertId   String
  kind      String
  payload   Json
  createdAt DateTime @default(now())

  @@index([alertId])
}

model User {
  id           String @id @default(uuid())
  email        String @unique
  name         String
  passwordHash String
  role         Role
}

model AuditLog {
  id       String   @id @default(uuid())
  userId   String?
  action   String
  entity   String
  entityId String?
  meta     Json
  at       DateTime @default(now())
}
```

*Raw SQL Partial Unique Index:*
```sql
CREATE UNIQUE INDEX alert_open_incident ON "Alert" ("cameraId", "dedupKey")
WHERE status IN ('OPEN', 'ACKNOWLEDGED');
```

---

### 3.3 Alert Lifecycle (State Machine)
```
OPEN ──ack──► ACKNOWLEDGED ──resolve──► RESOLVED
  │                 │
  └──false_alarm────┴──────────────────► FALSE_ALARM
```
- `RESOLVED` and `FALSE_ALARM` are terminal states. A new detection creates a new alert.
- `CRITICAL` alerts are never auto-resolved; only a supervisor can clear them (PRD FR-7). Auto-close applies only to `COMPLIANCE` alerts after a configurable quiet period.
- Every transition uses Compare-And-Swap (`version: expectedVersion`) to prevent race conditions between supervisors.

---

### 3.4 Ingest: Idempotent + Dedup Safety Net
- `POST /edge/alerts` (multipart: alert JSON + optional snapshot JPEG).
- Primary deduplication is handled by the edge cooldown timer (60s).
- The server enforces secondary deduplication: updates `hitCount`, `lastSeenAt`, and `confidence` on open incidents instead of duplicating alerts.

---

### 3.5 Realtime Gateway (Replay Without Gaps)
- Uses `@nestjs/platform-ws` with native WebSocket support.
- Envelope: `{ seq, type: "alert.created" | "alert.updated" | "camera.status" | "edge.health" | "ping" | "resync", data }`.
- Replay with `?since=<seq>`: Clients reconnecting send their last known sequence ID and receive all missed events in order.
- REST Cursor Rule: `GET /alerts?status=open,acknowledged` returns `{ items, cursor }` where `cursor = max(seq)` read before the query.

---

### 3.6 REST API Contract
| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/auth/login`, `/auth/logout` | POST | None / Cookie | Rate-limited, Argon2 password hash, JWT in httpOnly cookie |
| `/alerts` | GET | User | Queue and history, keyset pagination on `(firstSeenAt, id)` |
| `/alerts/:id` | GET | User | Alert details |
| `/alerts/:id/snapshot` | GET | User | Snapshot streamed through auth, never a public URL |
| `/alerts/:id` | PATCH | Supervisor+ | CAS transition: `{ action, expectedVersion, note? }`; `409` on stale |
| `/cameras`, `/sectors`, `/zones` | GET/POST/PATCH/DELETE | Admin | Bumps `ConfigState.version` |
| `/config/thresholds`, `/config/params` | PUT | Admin | Audited, validated ranges (fire threshold ceiling) |
| `/models`, `/models/:id/activate` | POST | Admin | Stores `report.json` metrics + `thresholds.json` |
| `/reports/compliance` | GET | Supervisor+ | Streamed CSV with aggregate metrics |
| `/edge/alerts` | POST | Edge API Key | Idempotent ingest with optional snapshot upload |
| `/edge/heartbeat` | POST | Edge API Key | Telemetry `{ fps, latencyMs, cpu, cameras }`, returns `clearAlarms` |
| `/edge/config` | GET | Edge API Key | Decrypted RTSP streams, zones, thresholds, ETag support |
| `/health/live`, `/health/ready` | GET | None (LAN) | Readiness probes check database health |

---

### 3.7 Dead-Man's Switch
- A background monitor runs every few seconds:
  - No heartbeat from an edge node for $>20\text{s}$ $\rightarrow$ mark node `OFFLINE`, emit `edge.health`, raise a `WARNING` system alert.
  - Camera `lastFrameAt` older than threshold $\rightarrow$ mark camera `OFFLINE`, emit `camera.status`, raise a `WARNING` blind-spot alert.

---

## 4. Edge Worker (Python)
- **Latest-frame reader:** Threaded non-blocking capture drops stale frames to eliminate latency drift.
- **Inference Runtime:** Executes [`models/best.onnx`](file:///c:/hackthon-2/models/best.onnx) using ONNX Runtime / OpenVINO.
- **Physical Alarm Latches:** Fires local hardware relay in $<10\text{ms}$ synchronously before any network call.
- **Unlatching Mechanism:** Latches physical alarm until authorized supervisor acknowledges on dashboard $\rightarrow$ server includes `alertId` in `clearAlarms` in the next heartbeat response $\rightarrow$ edge worker unlatches alarm.
- **Offline Outbox:** SQLite database in WAL mode stores alerts with exponential backoff retry.
- **MJPEG Server:** Local multipart HTTP stream on port 8080 for live grid display on dashboard.

---

## 5. Deployment (Single Site)
- `infra/docker-compose.yml`:
  - `postgres`: Persistent database volume.
  - `server`: NestJS backend running migrations on start.
  - `web`: Next.js 15 standalone dashboard.
  - `edge`: Python worker with hardware camera/GPIO access.
  - `caddy` (optional): LAN TLS reverse proxy.
