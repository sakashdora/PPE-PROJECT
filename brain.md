# FACTORY SAFETY AI — PERSISTENT BRAIN & CONTEXT MEMORY
> **CRITICAL AGENT INSTRUCTION (MANDATORY)**:
> 1. **Read this file FIRST** at the beginning of every session or turn before answering or proposing changes.
> 2. **Do NOT hallucinate** nonexistent architecture, uninstalled libraries, or hypothetical endpoints. All facts, credentials, and configurations in this file are ground truth.
> 3. **Automatically update this file** whenever changes, decisions, new features, or model updates are completed during a conversation.

---

## 1. Project Overview & Hackathon Identity
- **Project**: Factory Safety AI (Computer Vision Edge + On-Premise Safety Platform)
- **Event**: BPUT Hackathon 2026
- **Problem Statement**: **PS06 — Factory Safety AI**
- **Core Principle**: **Zero Cloud Dependency for Alarms**. The edge worker triggers the physical alarm directly in $<10\text{ms}$; the server and web dashboard provide real-time visibility, supervisor triage, compare-and-swap workflows, audit logging, and compliance reporting.

---

## 2. Active System Topology & Port Mapping

| Component | Technology | Directory | Port / URL | Status |
|---|---|---|---|---|
| **Supervisor Dashboard** | Next.js 15 (App Router, Tailwind) | `web/` | `http://localhost:3000` | **Running** (background daemon) |
| **On-Premise Server** | NestJS 11 + Prisma ORM + Native WS | `server/` | `http://localhost:4000`<br>`ws://localhost:4000/ws` | **Running** (background daemon) |
| **Edge Video Stream** | Python 3.12 + OpenCV MJPEG | `edge/` | `http://localhost:8080` | Available via Edge Daemon |
| **Database (Dev)** | SQLite (`file:./dev.db`) | `server/prisma/dev.db` | Local File | **Seeded & Active** |
| **Database (Prod)** | PostgreSQL 16 Alpine | `infra/docker-compose.yml` | `5432:5432` | Docker Compose Ready |

---

## 3. Seed Credentials & Authentication Keys

### Web Dashboard & API Users (Pre-seeded in `server/prisma/seed.ts`):
- **Admin**: `admin@factory.ai` | Password: `admin123` (Role: `ADMIN`)
- **Supervisor**: `supervisor@factory.ai` | Password: `supervisor123` (Role: `SUPERVISOR`)
- **Operator**: `operator@factory.ai` | Password: `operator123` (Role: `VIEWER`)

### Edge Node Security:
- **Shared Secret API Key**: `edge-api-key-factory-plant-01`
- Passed via header: `X-Edge-Api-Key: edge-api-key-factory-plant-01`
- Pre-seeded Node ID: `edge-node-01` (Name: `Factory Edge NUC-01`)
- Pre-seeded Cameras: `cam-01` (Assembly Line A), `cam-02` (Boiler & Steam Room), `cam-03` (Chemical Storage), `cam-04` (Welding & Fabrication)

---

## 4. AI & ML Model Tier (`models/` and `ml/`)

### Deployed Model (Stage 2 — Active ✅ Verified):
- **File**: `models/best_s2.onnx` (18.1 MB, FP16, full fine-tune of YOLO11s — **25/25 epochs, all layers unfrozen, cosine LR**).
- **Predecessor**: `models/best.onnx` kept as Stage 1 fallback (18.1 MB, Stage 1 transfer learning, 15 epochs frozen backbone).
- **Input Tensor**: `[1, 3, 640, 640]` (RGB, normalized $0.0 - 1.0$).
- **Output Tensor**: `[1, 15, 8400]` ($4\text{ bbox coordinates} + 11\text{ class probabilities}$).
- **✅ Stage 2 Confirmed Performance** (25/25 epochs, verified 2026-09-21):
  - Precision: **86.5%** ↑ (Stage 1: 84.3%, **+2.2pp**)
  - Recall: **73.5%**
  - mAP@50: **79.4%** ↑ (Stage 1: 77.1%, **+2.3pp**)
  - mAP@50-95: **54.8%**
  - ONNX Runtime inference: Input `[1,3,640,640]` → Output `(1,15,8400)` ✅
- **Stage 2 Training Config**: `lr0=0.001`, `lrf=0.0001`, `cos_lr=True`, `close_mosaic=10`, `freeze=0`, `batch=16`, `imgsz=640`, `epochs=25`.
- **CPU Inference Latency**: **< 15ms per frame** via ONNX Runtime.
- **Updated Thresholds** (tightened for Stage 2 confidence quality):
  - `fire: 0.40` (was 0.35) | `smoke: 0.35` (was 0.30) — fewer false positives, voter still provides recall safety.

### Uniform 11-Class Schema:
- `0: person` (Spatial anchor for anatomical body mapping)
- `1: helmet` (Head compliance)
- `2: head` (Bare head violation)
- `3: vest` (Hi-vis torso compliance)
- `4: gloves` (Hand protection compliance)
- `5: boots` (Steel-toe footwear compliance)
- `6: no_gloves` (Bare hands violation)
- `7: no_boots` (Bare/inappropriate footwear violation)
- `8: fire` (**CRITICAL** instant alarm trigger)
- `9: smoke` (**CRITICAL** instant alarm trigger)
- `10: cigarette` (**WARNING** restricted zone smoking trigger)

### Training Roadmap:
- **Stage 1 (Completed ✅)**: 15 epochs transfer learning with frozen backbone. Output: `models/best.onnx` (kept as fallback).
- **Stage 2 (Completed ✅)**: 25 epochs full fine-tuning, all layers unfrozen, cosine LR decay, close_mosaic=10. Output: `models/best_s2.onnx` — **currently active model**.

---

## 5. Edge Worker Tier (`edge/app/`)

### Key Components:
1. **`stream.py`**: Multi-threaded non-blocking capture with RTSP auto-reconnect and synthetic factory frame fallback.
2. **`infer.py`**: Multi-backend inference runtime supporting `ONNXRuntimeEngine` (using `models/best.onnx`), `OpenVINOEngine`, and mock testing engine.
3. **`postprocess.py`**:
   - Anatomical sub-region Person-PPE association: checks head region (top 35%), torso (15-70%), hands, and feet.
   - **Temporal Sliding-Window Voter**:
     - Fire / Smoke: $\ge 2$ of 5 frames (instant recall-first).
     - Missing PPE: $\ge 8$ of 10 frames (eliminates occlusion noise).
     - Smoking: $\ge 4$ of 8 frames in restricted zone.
   - Cooldown timer (60s default).
4. **`alarm.py` (`LocalAlarmController`)**:
   - Fires hardware GPIO relay / local buzzer in $<10\text{ms}$ synchronously before network I/O.
   - Tracks `active_alert_ids`.
   - **Unlatching Protocol**: `unlatch(clear_alert_ids)` resets relay and silences buzzer when server confirms supervisor acknowledgment.
5. **`heartbeat.py` (`HeartbeatClient`)**:
   - Transmits telemetry every 5s to `POST /edge/heartbeat` with `X-Edge-Api-Key`.
   - Receives `clearAlarms: string[]` from server to trigger `alarm_controller.unlatch()`.
   - Checks `configVersion` for dynamic threshold/zone reloading.
6. **`outbox.py` (`OutboxManager`)**:
   - Transactional SQLite outbox (`outbox.db`).
   - Alerts saved to local disk first; background thread synchronizes to `POST /edge/alerts`.
   - Supports multipart/form-data upload of snapshot JPG images.

---

## 6. On-Premise Server Tier (`server/src/`)

### Architecture & Endpoints:
- **Framework**: NestJS 11 + Prisma ORM + `@nestjs/platform-ws`
- **Modules**:
  - `AuthModule`: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
  - `EdgeModule`:
    - `POST /edge/alerts`: Idempotent ingestion via UUID; 60s secondary deduplication window updating `hitCount`.
    - `POST /edge/heartbeat`: Telemetry updates, camera status tracking, returns `clearAlarms` for acknowledged incidents.
    - `GET /edge/config`: Dynamic configuration with `ETag` / `If-None-Match`.
  - `AlertsModule`:
    - `GET /alerts`: Filter by status, severity, camera, date range.
    - `GET /alerts/:id`: Alert details with associated camera & sector.
    - `GET /alerts/:id/snapshot`: Streams saved snapshot JPEG.
    - `PATCH /alerts/:id`: Compare-and-Swap (CAS) state machine (`expectedVersion`).
      - Allowed: `OPEN -> ACKNOWLEDGED -> RESOLVED / FALSE_ALARM`.
      - Rejects stale concurrent updates with HTTP `409 Conflict`.
  - `RealtimeModule`:
    - `ws://localhost:4000/ws`: Native WebSocket gateway.
    - Replay parameter: `?since=<seq>` allows gapless playback of missed `AlertEvent` records.
    - Keepalive ping: Server pings clients every 5 seconds.
  - `HealthModule` & `OfflineDetectorService`:
    - `GET /health/live`, `GET /health/ready`.
    - **Dead-Man's Switch Cron**: Checks every 5 seconds. If edge node silent $>20\text{s}$ or camera stops streaming $>15\text{s}$, automatically flags offline/stalled and raises system warning alert.
  - `ReportsModule`:
    - `GET /reports/compliance?format=csv`: Streams downloadable CSV of all shift violations.
    - `GET /reports/aggregates`: Summary metrics (total, open, acknowledged, resolved, false alarms).
  - `RetentionModule`: Cron cleaning up snapshots (>30 days) and audit logs (>90 days).

---

## 7. Supervisor Web Dashboard Tier (`web/`)

- **Framework**: Next.js 15 App Router, React 19, Tailwind CSS.
- **Environment**: Configured in `web/.env.local` (`NEXT_PUBLIC_API_URL=http://localhost:4000`, `NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws`).
- **Core Views**:
  - `/wall`: 4-camera live industrial grid, real-time MJPEG feed from port 8080 with canvas simulation fallback, critical emergency audio siren with user-interaction unlock modal.
  - `/alerts`: Triage queue with multi-language (English / Hindi) hazard translations, snapshot inspection drawer, one-click CAS acknowledgment and resolution.
  - `/history`: Historical shift logs and violation timeline.
  - `/reports`: Compliance trends and CSV export.
  - `/admin/cameras` & `/admin/zones/[cameraId]`: Interactive SVG zone definition editor with polygon coordinate normalization.

---

## 8. Verification & Test Suite Status

### Automated E2E Suite (`server/test_e2e.js`):
Passed 9/9 checks with exit code 0:
1. `[PASS]` Health Endpoints (`/health/live` and `/health/ready` 200 OK)
2. `[PASS]` Supervisor Authentication (JWT issuance and role validation)
3. `[PASS]` Edge Heartbeat Telemetry (`POST /edge/heartbeat` with `X-Edge-Api-Key`)
4. `[PASS]` Native WebSocket Handshake & Replay (`ws://localhost:4000/ws?since=0`)
5. `[PASS]` Idempotent Alert Ingestion (Duplicate UUID returns `already_exists`)
6. `[PASS]` 60-Second Secondary Deduplication (Increments `hitCount` on existing incident)
7. `[PASS]` CAS State Machine (Rejects version mismatch with `409 Conflict`; accepts valid transition to `ACKNOWLEDGED`)
8. `[PASS]` Edge Alarm Unlatching (`clearAlarms: [alertId]` returned in heartbeat for physical siren reset)
9. `[PASS]` CSV Compliance Report Stream & Metrics Aggregation

### Unit Tests:
- `edge/tests/`: 7/7 pytest tests passed (`test_association.py`, `test_cooldown.py`, `test_voter.py`).

---

## 9. Recent Changes Changelog (Auto-Updated)

| Date / Timestamp | Component | Action / Change Description |
|---|---|---|
| 2026-09-20 | `ml/` | Trained YOLO11s Stage 1 model on Google Colab GPU (84.3% P, 77.1% mAP50). Exported to `best.onnx`. |
| 2026-09-20 | `models/` | Verified `models/best.onnx` with ONNX Runtime on real factory test images. |
| 2026-09-20 | `server/` | Initialized NestJS on-prem server with Prisma (SQLite dev, PostgreSQL prod), seed script, and 8 core modules. |
| 2026-09-20 | `server/` | Implemented CAS state machine, dead-man's switch cron, native WebSocket gateway with replay, and CSV export. |
| 2026-09-20 | `edge/` | Added `edge/app/heartbeat.py` (`HeartbeatClient`) with physical alarm unlatching protocol and config sync. |
| 2026-09-20 | `edge/` | Updated `edge/app/alarm.py` to track active alert IDs and unlatch relays upon server signal. |
| 2026-09-20 | `edge/` | Updated `edge/app/outbox.py` with `X-Edge-Api-Key` headers and multipart snapshot uploading. |
| 2026-09-20 | `infra/` | Created `infra/docker-compose.yml`, `infra/.env.example`, and `server/Dockerfile`. |
| 2026-09-20 | `web/` | Created `web/.env.local` pointing frontend to NestJS backend on port 4000 and WS on port 4000. |
| 2026-09-20 | `server/` | Created and ran `server/test_e2e.js`, validating 9/9 end-to-end integration requirements. |
| 2026-09-20 | `root` | Created `brain.md` and `AGENTS.md` to prevent hallucinations and maintain persistent agent memory. |
| 2026-09-20 | `audit/` | **INTEGRATION AUDIT** — Ran MASTER PROMPT audit. Found and fixed 5 interface mismatches. |
| 2026-09-20 | `web/api/edge/alerts` | BUG-1 FIX: Replaced in-memory stub with HTTP proxy to NestJS `POST /edge/alerts`. Alerts now reach Prisma DB and trigger WebSocket broadcast even via fallback path. |
| 2026-09-20 | `web/api/edge/heartbeat` | BUG-2 FIX: Replaced in-memory stub with NestJS proxy. `clearAlarms` and `configVersion` now relay correctly — physical alarm unlatch works via fallback path. Fail-closed: returns `clearAlarms: []` if NestJS is down. |
| 2026-09-20 | `web/api/edge/config` | BUG-3 FIX: Fixed critical `server_url: "http://localhost:3000"` bug (would loop edge back to Next.js). Now proxies from NestJS with ETag. Both live and fallback always return `server_url: "http://localhost:4000"`. |
| 2026-09-20 | `web/realtime/wsClient.ts` + `alerts.store.ts` + `layout.tsx` | BUG-4 FIX: Cursor was ISO date string; WS gateway expects integer seq. Now `wsClient` tracks `envelope.seq`, calls `onSeq()`, store uses `number | null` cursor. Gapless replay now correctly resumes from last seen event. |
| 2026-09-20 | `web/features/alerts/AlertDrawer.tsx` + `web/lib/types.ts` | BUG-5 FIX: Supervisor Acknowledge/Resolve/FalseAlarm now call `PATCH /alerts/:id` CAS on NestJS. Added `version` field to `Alert` type. Error banner shows 409/401. Falls back to optimistic update when offline. |
| 2026-09-20 | `audit/` | E2E re-verification: 9/9 PASSED. 4/4 proxy probes PASSED. Full alert chain proven. |
| 2026-09-21 | `models/` | **Stage 2 ONNX deployed**: `best_s2.onnx` (25 epochs, full fine-tune, cosine LR, FP16). `edge/app/config.py` updated: `model_path → models/best_s2.onnx`, fire threshold `0.35→0.40`, smoke threshold `0.30→0.35`. Stage 1 `best.onnx` retained as fallback. |
| 2026-09-21 | `web/` | **Full frontend redesign** to match new design mockup: (1) `globals.css` — Inter+JetBrains Mono fonts, all animation keyframes, `.text-2xs/.text-3xs` utilities; (2) `tailwind.config.ts` — extended color palette (nav/info/safe), fontSize 2xs/3xs, new animation tokens; (3) `Navbar.tsx` — new shield logo, blue pill active nav links, ONLINE status pill, language dropdown, SHIFT+time block, user avatar; (4) `CriticalBanner.tsx` — slim 36px red ticker bar with scrolling text; (5) `app/(app)/layout.tsx` — full-screen `h-screen overflow-hidden`, Navbar→Banner→main→StatusFooter; (6) `StatusFooter.tsx` (new) — WebSocket/last event/cameras/edge nodes/model/system health; (7) `wall/page.tsx` — full-width two-panel layout (camera grid left, 360px alert queue right), 2x2/3x3/4x4 toggle, sector filter, filter tabs All/Critical/Warning/Info, new AlertQueueCard with severity bar/tags/chevron; (8) `StreamTile.tsx` — top overlay LIVE/FPS/latency/expand, richer canvas bounding boxes (PERSON/HELMET green, NO HELMET red dashed, FIRE orange glow), bottom tile-footer-gradient with COMPLIANCE badge. TypeScript: 0 errors. |
| 2026-09-21 | `web/layout.tsx` | **Frontend Inspection & Fit Fix**: (1) Live browser verification across 2x2, 3x3, and maximized viewports confirmed 0 visual glitches, no cut-off elements, and accurate bounding box overlays. (2) Updated `AppLayout` with `usePathname()` so `/wall` remains 100% full-bleed edge-to-edge with no viewport overflow, while triage/history/analytics pages get scrollable max-w-7xl containers. (3) Integrated `ConnectionBar` offline fallback notice into global header chrome. TypeScript: 0 errors. |

---

## 10. Rules for Future Agent Interactions
Whenever working on this codebase:
1. **Always read `brain.md`** first before taking any action.
2. **Never change port assignments**: Next.js is `3000`, NestJS is `4000`, Edge MJPEG is `8080`.
3. **Preserve zero-cloud alarm guarantee**: Edge worker MUST be capable of sounding physical alarm without server or internet.
4. **Append all new changes** to the changelog in Section 9 of `brain.md` at the end of each session.
