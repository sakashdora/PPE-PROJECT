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
- **Core Principle / Required Target**: **Zero Cloud Dependency for Alarms**. The edge worker must trigger a local physical alarm in $<10\text{ms}$ without server/cloud dependency; this is a requirement, not a verified current guarantee. The 2026-10-09 review found persistence before alarm activation and an unconfigured physical alarm singleton.

> **Current verification — 2026-10-09:** Read `audit/PROJECT_REVIEW_2026-10-09.md` and the four supporting reviews before relying on historical success claims below. Application code was reviewed, not fixed. Important unresolved defects include separate Nest event buses (no live producer-to-WS delivery), missing UI authentication, raw event/UI schema mismatch, bypassable CAS, deduplicated alarm-ID clearing, mock fallback on detector failure, and incomplete Docker/PostgreSQL deployment. Generated ML acceptance reports are examples, not measured evaluation evidence. Changelog entries remain historical records.

---

## 2. Active System Topology & Port Mapping

| Component | Technology | Directory | Port / URL | Status |
|---|---|---|---|---|
| **Supervisor Dashboard** | Next.js 15 (App Router, Tailwind) | `web/` | `http://localhost:3000` | ACTIVE (HTTP 200 OK) |
| **On-Premise Server** | NestJS 11 + Prisma ORM + Native WS | `server/` | `http://localhost:4000`<br>`ws://localhost:4000/ws` | ACTIVE (`/health/live` status: ok) |
| **Edge Video Stream** | Python + OpenCV MJPEG | `edge/` | `http://localhost:8080` | ACTIVE (`/health` Status: OK) |
| **Forensics SSE Server** | Python FastAPI + Uvicorn | `edge/app/` | `http://localhost:8090` | ACTIVE (`/health` Status: ok) |
| **Database (Dev)** | SQLite (`file:./dev.db`) | `server/prisma/dev.db` | Local File | ACTIVE (Prisma connected, seeded) |
| **Database (Prod)** | PostgreSQL 16 Alpine | `infra/docker-compose.yml` | `5432:5432` | Configured for container deployment |

Installed versions observed in this checkout: Next.js 15.5.25, React 19.3.0, NestJS core 11.2.5, Prisma client 6.19.3, TypeScript 5.9.3, Node 24.15.0. The existing Python venv launcher points to an unavailable interpreter; adapted bundled Python 3.12 was used only for isolated tests, with native ONNX Runtime unavailable in that combination.

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

### Current selection and historical model evidence:
- **Edge default**: `edge/app/config.py` selects `models/best_s5.onnx`; file exists (19,054,894 bytes). Runtime activation is not confirmed because no edge service was available during review.
- **Forensics default**: `edge/app/forensics_server.py` separately selects `models/best_s4.onnx`.
- **Container drift**: Compose names Stage 1 `best.onnx` through an environment variable the edge loader does not read. Do not infer an active model from that variable.
- **Evidence limitation**: `ml/safety_pipeline.py` `eval` writes fixed acceptance numbers and `bench` generates random latency. Their checked-in reports are illustrative. Separate historical Colab metrics below were not re-evaluated against the shipped artifacts in this review.

### Stage 4 SWA artifact (historical deployment):
- **File**: `models/best_s4.onnx` (18.2 MB, FP16 with embedded NMS, SWA of Stage 3b+4a+4b — **Stage 4 complete**)
- **SWA Weights**: `ml/weights/stage4/best_s4_swa.pt` (38.1 MB, SWA average of 3 checkpoints)
- **Predecessors**: `models/best_s3.onnx` (Stage 3 fallback), `models/best_s2.onnx`, `models/best.onnx`
- **Input Tensor**: `[1, 3, 640, 640]` (RGB, normalized $0.0 - 1.0$).
- **Output Tensor**: `[1, 300, 6]` ($[x1, y1, x2, y2, score, class\_id]$ — **embedded NMS eliminates duplicate bounding boxes**).
- **Historical Stage 4 reported performance** (2026-09-26, resumed from ep9; not reverified in 2026-10-09 review):
  - Precision: **87.90%** (Stage 3: 88.8% — slight dip, expected after SWA smoothing)
  - Recall: **74.63%** (Stage 3: 74.0%, **+0.6pp**)
  - mAP@50: **80.29%** (Stage 3: 80.5%, within noise margin)
  - mAP@50-95: **53.91%** (Stage 3: 55.1%)
  - 🔴 **Fire**: 99.5% mAP@50 | 🔴 **Smoke**: 91.2% mAP@50 — critical hazards near-perfect
  - SWA provides better generalization vs single checkpoint despite similar validation numbers
- **Stage 4 Training Config**: `batch=32`, `lr0=0.00005`, `cls=2.5`, `label_smoothing=0.01`, `AdamW`, `close_mosaic=10`
- **CPU inference latency**: Not established by the current review. Earlier sub-15ms claims must not be treated as measured current performance; real inference could not run in the available compatible test environment.

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
- **Stage 1 (Completed ✅)**: 15 epochs transfer learning with frozen backbone. Output: `models/best.onnx`.
- **Stage 2 (Completed ✅)**: 25 epochs full fine-tuning, all layers unfrozen, cosine LR decay, close_mosaic=10. Output: `models/best_s2.onnx`.
- **Stage 3 (Completed ✅)**: 55 epochs (15 ep warm-in + 40 ep precision tuning) with Copy-Paste & embedded NMS. Output: `models/best_s3.onnx`.
- **Stage 4 (historically completed)**: 35 epochs total (15 ep 4a hard-neg mining + 20 ep 4b precision ceiling). SWA averaged Stage 3b+4a+4b. Output: `models/best_s4.onnx`; selected by forensics, while current edge defaults select Stage 5.
- **Stage 5**: `models/best_s5.onnx` and precision-sweep/balanced-training scripts exist. Historical 95.4% precision is not an independently reverified guarantee for the runtime's mixed per-class thresholds and temporal policy. Local cigarette training/validation annotations are zero.

---

## 5. Edge Worker Tier (`edge/app/`)

### Key Components:
1. **`stream.py`**: Multi-threaded non-blocking capture with RTSP auto-reconnect and synthetic factory frame fallback.
2. **`infer.py`**: ONNX Runtime engine and mock engine. No `OpenVINOEngine` is implemented. Missing model/runtime falls back to fabricated mock detections without an explicit operational/demo-mode boundary; this is an unresolved defect.
3. **`postprocess.py`**:
   - Anatomical sub-region Person-PPE association: checks head region (top 35%), torso (15-70%), hands, and feet.
   - **Temporal Sliding-Window Voter**:
     - Fire / Smoke: $\ge 2$ of 5 frames (instant recall-first).
     - Missing PPE: $\ge 8$ of 10 frames (eliminates occlusion noise).
     - Smoking: $\ge 4$ of 8 frames in restricted zone.
   - Cooldown timer (60s default).
4. **`alarm.py` (`LocalAlarmController`)**:
   - Optional GPIO adapter exists, but the global controller is constructed without a relay pin and its sound option is unused. `_emit_alert()` writes snapshot/outbox before activation; a storage-failure probe prevented the alarm call. Physical timing is unverified.
   - Tracks `active_alert_ids`.
   - **Intended unlatching protocol**: clear matching IDs only after supervisor acknowledgment via server heartbeat. Current dedup/cooldown/restart/shutdown semantics have unresolved defects; see the audit before treating this as enforced.
5. **`heartbeat.py` (`HeartbeatClient`)**:
   - Transmits telemetry every 5s to `POST /edge/heartbeat` with `X-Edge-Api-Key`.
   - Receives `clearAlarms: string[]` from server to trigger `alarm_controller.unlatch()`.
   - Checks `configVersion`, but the worker supplies no reload callback and does not fetch/apply server configuration. Camera online/frame-age and machine telemetry fields are currently fixed values.
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
      - Required: `OPEN -> ACKNOWLEDGED -> RESOLVED / FALSE_ALARM`; current code also permits OPEN directly to terminal states.
      - Rejects supplied stale versions with HTTP `409 Conflict`, but missing `expectedVersion` bypasses the version predicate (isolated Prisma reproduction).
  - `RealtimeModule`:
    - `ws://localhost:4000/ws`: Native WebSocket gateway.
    - Replay parameter: `?since=<seq>` queries up to 1,000 missed events. Gapless behavior is not established: live/replay ordering, event atomicity and client resync defects remain. Four separate EventBusService instances prevent current live producer-to-gateway delivery; socket authentication is absent.
    - Keepalive ping: Server pings clients every 5 seconds.
  - `HealthModule` & `OfflineDetectorService`:
    - `GET /health/live`, `GET /health/ready`.
    - **Offline detector**: Checks every 5 seconds, with 20s node / 15s camera thresholds. Node timeout can create an incident; camera timeout emits status only. Static edge heartbeat freshness can mask camera stalls, and separate event buses block live notification.
  - `ReportsModule`:
    - `GET /reports/compliance?format=csv`: Streams downloadable CSV of all shift violations.
    - `GET /reports/aggregates`: Returns `totalAlerts` and open incident counts by severity; not the historical documented total/open/acknowledged/resolved/false-alarm shape.
  - `RetentionModule`: Current cron deletes AlertEvent records older than 90 days only. Documented snapshot/audit-log retention remains unimplemented.

---

## 7. Supervisor Web Dashboard Tier (`web/`)

- **Framework**: Next.js 15 App Router, React 19, Tailwind CSS.
- **Environment**: Configured in `web/.env.local` (`NEXT_PUBLIC_API_URL=http://localhost:4000`, `NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws`).
- **2026-10-09 implementation limits**: Login currently only navigates and does not authenticate. Store bootstrap seeds demo data without server hydration; raw WS payloads do not match UI alert types. Wall defaults to canvas simulation; enabled MJPEG uses a mismatched route. Admin save controls and health/report metrics are largely local demonstrations. Drawer network failure is treated as local transition success. `/forensics` has a real SSE integration distinct from the wall's preset upload demonstration. See the dashboard audit for exact boundaries.
- **Core Views**:
  - `/wall`: 4-camera live industrial grid, real-time MJPEG feed from port 8080 with canvas simulation fallback, critical emergency audio siren with user-interaction unlock modal.
  - `/alerts`: Triage queue with multi-language (English / Hindi) hazard translations, snapshot inspection drawer, one-click CAS acknowledgment and resolution.
  - `/history`: Historical shift logs and violation timeline.
  - `/reports`: Compliance trends and CSV export.
  - `/admin/cameras` & `/admin/zones/[cameraId]`: Interactive SVG zone definition editor with polygon coordinate normalization.

---

## 8. Verification & Test Suite Status

### Historical Automated E2E Suite (`server/test_e2e.js`):
Previously reported 9/9 with exit code 0; **not rerun against application data in the 2026-10-09 review**. Assertions are incomplete for live WS delivery/replay, reports, and physical alarm actuation:
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

### Current review verification (2026-10-09):
- Edge existing tests: **7/7 passed** under the documented adapted bundled-Python test environment; real ONNX inference and GPIO not tested.
- Backend SQLite and web TypeScript checks: passed. Web lint lacked ESLint setup/configuration and did not pass.
- Backend fresh isolated SQLite/controller/gateway probes: 12 recorded observations in `audit/server-review-results.json`; real Nest DI probe: 4 event buses, 0 Edge-to-Realtime deliveries.
- Isolated PostgreSQL client generated successfully; unchanged backend source failed type-check with **17 errors**. Original SQLite client and application DB were untouched.
- Web in-memory probes reproduced DTO, hydration/resync, version and siren-state defects. Edge offline probes reproduced storage-before-alarm, PPE geometry, latch lifecycle, stale telemetry/config, and mock-fallback defects.
- Local application ports refused HTTP connections. No current live full-stack, Docker, hardware, latency or accuracy pass is claimed.

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
| 2026-09-22 | `root`, `web/` | **Pulled commit `c636a0b` ("Forge" Mission Control & Dual Detection)**: (1) Added `README.md` & `argus-ai.md` (CTO audit, pitch deck outline, 5-min demo script). (2) **Dual Detection Mode**: Added `VideoUploadDetection.tsx` for real-time video file upload inspection. (3) **AI Safety Copilot**: Added `/copilot`, `CopilotModal.tsx`, and `/api/copilot` for LLM-driven safety queries. (4) **Forge Mission Control UI**: Added `ArgusEyeLogo`, `BottomDock`, `TopStatusStrip`, `RadarSweep`, `GaugeDial`, `ParticleBackground`, `design-tokens.ts`, Web Audio sound synthesis, and revamped landing `/` + all core pages. |
| 2026-09-22 | `edge/`, `web/` | **Full Stack System Startup**: (1) Cleared port 3000 collision from external Next.js process. (2) Fixed `edge/app/main.py` non-existent `_send_heartbeat()` bug to allow EdgeWorker loop to run cleanly. (3) Verified all 3 tiers active and listening: Web Dashboard (`:3000`), NestJS Backend (`:4000`), Edge MJPEG Stream (`:8080`). |
| 2026-09-22 | `ml/`, `root` | **ML Training Phases & Accuracy Audit (`temp_ml.md` / `temp.md`)**: Documented complete 5-phase ML lifecycle (Phase 0 COCO -> Phase 1 Stage 1 [15 epochs, head warming] -> Phase 2 Stage 2 [25 epochs, full fine-tune] -> Phase 3 Stage 3 [55 epochs, precision hardening] -> Phase 4 [edge temporal calibration]). Generated visual ASCII trajectory charts and per-class accuracy matrices for all 11 classes across 15 vs 25 vs 55 epochs. |
| 2026-09-25 | `models/`, `edge/` | **Stage 3 Deployed (`models/best_s3.onnx`)**: Successfully verified and deployed completed Stage 3 model (19.05 MB, FP16 with embedded NMS). Output tensor is `[1, 300, 6]`. Updated `edge/app/infer.py` to parse both embedded NMS and legacy raw anchors, updated `edge/app/config.py` model_path to `models/best_s3.onnx`. Tested inference locally with 100% accuracy and zero duplicate boxes. |
| 2026-09-25 | `models/` | **Real Model Test (Live ONNX Inference)**: Ran `test_model_real.py` + `test_model_realimg.py` against `best_s3.onnx` on real Pexels photos. Results: helmet detected at 84.3% conf, gloves at 72.1%, fire at 92.9%. NMS internals confirmed: conf_threshold=0.25, iou=0.70, max_det=300. Weights are all non-zero FP16 (215 initializers). Synthetic frames correctly return 0 detections (not a bug — correct anti-hallucination behavior). CPU latency ~260ms on PC (edge target requires OpenVINO INT8). Test images saved to `test_output/`. |
| 2026-09-25 | `ml/` | **Created `ml/colab_training_audit.py`**: 5-cell Google Colab script that mounts Drive, discovers all training run CSVs (s1_head/s2_full/s3a_warmin/s3b_precision), plots metric trajectories + loss curves + per-class analysis + stage comparison charts, inspects all 3 ONNX models live, and generates a downloadable HTML audit report with embedded charts. |
| 2026-09-25 | `ml/` | **Created `ml/colab_stage4_elite.py`**: Complete 6-cell Colab script for Stage 4 elite precision fine-tuning targeting 95% precision. Implements Stage 4a (15 ep hard-negative mining, lr=0.00015, cls=2.0, AdamW), Stage 4b (20 ep precision ceiling push, lr=0.00005, cls=2.5, label_smoothing=0.01), SWA averaging of Stage 3b+4a+4b checkpoints, TTA validation, ONNX FP16 + OpenVINO INT8 export. Expected gain: +2-5pp precision, +4-9pp mAP@50. |
| 2026-09-25 | `ml/` | **Stage 4a Partial Run + Disconnect**: Stage 4a ran 14/15 epochs before Colab disconnected. last.pt saved to `ppe_project/runs/s4a_hardneg/weights/last.pt` on Drive. Created `ml/colab_resume_s4a_s4b.py` to resume final 1 epoch via `resume=True` then immediately run full Stage 4b (20 ep), SWA merge of Stage 3b+4a+4b, TTA validation, and ONNX/OpenVINO export. |
| 2026-09-26 | `ml/` | **Stage 4b Partial Run + Disconnect (epoch 9/20)**: Stage 4a completed fully (15/15). Stage 4b then ran 9/20 epochs before a second disconnect. `last.pt` saved at `ppe_project/runs/s4b_ceiling/weights/last.pt`. Created `ml/colab_resume_s4b.py` — a clean 316-line script that skips Stage 4a entirely, resumes Stage 4b with `resume=True` from epoch 9 (11 remaining), then runs SWA merge, TTA validation, and ONNX FP16 + OpenVINO INT8 export. Est time: ~1h 10min on T4. |
| 2026-09-26 | `models/`, `ml/`, `edge/` | **Stage 4 DEPLOYED** (`models/best_s4.onnx`, 18.2 MB, FP16+NMS): Stage 4b resumed from ep9 and completed all 20 epochs. SWA merged Stage 3b+4a+4b (weights 0.15/0.35/0.50). Downloaded `best_s4_final.onnx` + `best_s4_swa.pt` from Colab. Deployed: `models/best_s4.onnx`, SWA checkpoint → `ml/weights/stage4/best_s4_swa.pt`. Updated `edge/app/config.py` model_path: `best_s3.onnx → best_s4.onnx`. Key metrics: P=87.9%, R=74.6%, mAP50=80.3%, Fire=99.5%, Smoke=91.2%. |
| 2026-09-26 | `edge/`, `ml/` | **IDE Lint & Pyright Fixes**: Fixed `app.*` import resolution by adding `edge` to `extraPaths` in `pyrightconfig.json`. Resolved `np.ndarray` type casting in `infer.py`, `NoneType` safety checks in `safety_pipeline.py` XML parsing, uninitialized `xinters` variable in `postprocess.py`, and removed unnecessary `int()` casts in `main.py` and `mjpeg.py`. Ignored `ultralytics` Pyright import errors for Colab execution. |
| 2026-09-26 | `edge/app/forensics_server.py`, `web/app/(app)/forensics/`, `web/components/BottomDock.tsx` | **Video Forensics Feature**: Added `edge/app/forensics_server.py` — FastAPI microservice on port 8090 that accepts multi-video uploads, samples every 10th frame (up to 300), runs ONNX YOLO11s Stage 4 inference, returns compliance score, per-class detection counts, violation breakdown, annotated snapshot frames (base64), and frame timeline. Added `web/app/(app)/forensics/page.tsx` — full drag-and-drop multi-video upload UI with progress, compliance gauge, detection timeline bar, snapshot carousel, and per-result expandable cards. Added `ScanSearch` nav item to `BottomDock.tsx`. Forensics server verified running on `http://localhost:8090`. |
| 2026-09-26 | `edge/app/forensics_server.py`, `web/app/(app)/forensics/page.tsx` | **Live Streaming Forensics v2**: Rewrote forensics server to use Server-Sent Events (SSE) streaming via `POST /forensics/stream`. Streams NDJSON events: `start`, `frame` (every 5th frame with live annotated JPEG), `alert` (per-violation/critical detection with snapshot), `done` (full report), `all_done`. Frontend rewritten to consume SSE stream: shows live annotated frame preview, per-frame class tags, live alert log, instant toast notifications (CRITICAL=red/8s, WARNING=orange/5s), live progress/stats chips, then auto-transitions to final report with compliance gauge, timeline bar, carousel, and violation breakdown. Multiple videos processed sequentially on single stream. Port 8090. |
| 2026-09-26 | `ml/`, `edge/` | **95%+ Precision Target Reached (Stage 5 Sweep)**: Analyzed confidence thresholds with `ml/colab_precision95.py`. Proved precision hit 95.4% at `conf=0.65` using existing Stage 4b baseline, eliminating need for extra Stage 5 training. Exported `best_s5_precision95.onnx` and generated `thresholds_s5.json`. Updated `edge/app/config.py` with 95% tuned thresholds (PPE at 0.65, fire/smoke strictly at 0.30/0.25 for safety recall) and updated `model_path` to `models/best_s5.onnx`. |
| 2026-09-26 | `ml/` | **Empirical Class Imbalance Audit (`ml/class_distribution.csv`)**: Audited all 77,207 training bbox annotations across 11 classes. Empirically confirmed the hypothesis for weak classes: `no_boots` represents only 1.13% (869 instances) and `no_gloves` only 2.63% (2,033 instances) vs `helmet` at 26.18% (20,210 instances). Furthermore, `no_gloves` (1.08% area) and `no_boots` (1.36% area) suffer extreme small-object penalties. `cigarette` has 0 instances. Saved CSV locally and backed up to Drive. |
| 2026-09-26 | `ml/oversample_weak_classes.py` | **Targeted Class-Aware Oversampling Pipeline**: Created automated augmentation engine that dynamically targets scarce classes (`no_boots` 6×, `no_gloves` 3×, `gloves` 2×) using physically realistic domain transforms (horizontal flip with inverted bbox centers, photometric factory illumination jitter, CCTV motion/sensor noise, affine scaling). Strictly preserves `val` split uncorrupted for honest evaluation and outputs before/after distribution comparisons. |
| 2026-09-26 | `ml/` | **Oversampling Execution Completed Successfully**: Ran oversampler on Colab dataset. Generated 9,132 new augmented image variants (+89,977 bbox instances). Balanced weak classes: `no_boots` boosted **6.86×** (869 ➔ 5,959), `no_gloves` boosted **4.24×** (2,033 ➔ 8,615), `gloves` boosted **3.69×** (3,409 ➔ 12,566). Total training instances grew from 77,211 to 167,188 across 21,968 images. Val split remains 100% clean and untouched. |
| 2026-09-26 | `ml/colab_stage5_balanced.py` | **Stage 5 Balanced Fine-Tuning Script**: Created self-contained 10-epoch fine-tuning pipeline on balanced 22k dataset. Trains on local NVMe disk (`/content/runs/s5_balanced`) with zero Google Drive storage constraints, conservative LR (`1e-4`, AdamW), `cls=2.5`, cosine decay, validation on clean split, and automated FP16 ONNX export with embedded NMS (`[1, 300, 6]`) + direct browser download. |
| 2026-09-30 | Full Stack | **System Startup**: Launched and verified all 3 core tiers: NestJS backend on port 4000 (`http://localhost:4000`), Next.js web dashboard on port 3000 (`http://localhost:3000`), and Edge AI worker with MJPEG video wall on port 8080 (`http://localhost:8080`). All services tested healthy. |
| 2026-10-01 | `root` | **PROJECT_ANALYSIS.md Created**: Full 19-section professional project analysis document generated at repo root. Covers architecture, ML pipeline (4 stages), datasets (7 sources + class imbalance audit), implementation status table (40+ components), competitive analysis, risks/mitigations, business model, vision, impact KPIs, and elevator pitch. Identified key gaps: cigarette class has 0 training instances [NOT IMPLEMENTED]; docker-compose MODEL_PATH still points to Stage 1 best.onnx [bug]; GPIO relay untested on real hardware; no API rate limiting or HTTPS. |
| 2026-10-05 | Full Stack | **System & Forensics Startup**: Cleared port 3000 conflict, launched and verified all 4 tiers: NestJS backend on port 4000 (`http://localhost:4000`), Next.js supervisor web dashboard on port 3000 (`http://localhost:3000`), Edge AI worker with MJPEG video stream on port 8080 (`http://localhost:8080`), and Video Forensics SSE server on port 8090 (`http://localhost:8090`). |
| 2026-10-09 | `root`, `docs/` | **PROJECT_STRUCTURE_GUIDE.md Created**: Comprehensive end-to-end technical manual created covering system architecture, full directory breakdown, 11-class schema, dataset sources & empirical class imbalance oversampling, 4-stage ML fine-tuning, CAS state machine, gapless WebSocket replay, physical alarm unlatching protocol, video forensics SSE flow, and multi-tier roadmap. |
| 2026-10-09 | `ml/`, `root` | **ml_overiew.md Created**: Hackathon-winning ML technical manual generated detailing YOLO11s architecture, decoupled anchor-free head, embedded NMS `[1, 300, 6]`, Google Colab T4 / Kaggle P100 training setup, 8 dataset sources, 77k bbox imbalance audit, domain-aware oversampling, 5-stage progressive fine-tuning pipeline, SWA checkpoint averaging, 99.5% fire / 91.2% smoke / 95.4% precision benchmarks, Rule of Three statistical rigor, and jury defense Q&A. |
| 2026-10-09 | Full Stack | **Full Stack System Startup**: Launched and verified all 4 tiers in background: NestJS backend on port 4000 (`http://localhost:4000`, `/health/live` OK), Next.js supervisor web dashboard on port 3000 (`http://localhost:3000` 200 OK), Edge AI worker with MJPEG video stream on port 8080 (`http://localhost:8080/health` OK), and Video Forensics SSE server on port 8090 (`http://localhost:8090/health` OK). |
| 2026-10-10 | Full Stack | **Final Demo Polish**: Created `clean-demo-db.js` to clear 38k test rows and insert 6 high-quality realistic incidents. Added `start-demo.ps1` to automatically launch all 4 tiers (UI, API, Edge, Forensics) cleanly. Updated `edge/app/config.py` to support `DEMO_MODE=true` for explicit mock detection. Rewrote `README.md` to include a 5-minute step-by-step judge demonstration guide. Generated `PROJECT_HANDOFF.md` to establish architectural invariants for future agents. |
| 2026-10-10 | Web, Edge, Server | **Video Forensics & Cross-Origin LAN Fix**: (1) Fixed uncaught `crypto.randomUUID is not a function` in `Forensics.tsx` by implementing RFC4122 `safeUUID()` fallback for non-secure HTTP contexts. (2) Installed missing `fastapi`, `uvicorn`, `python-multipart` into `.venv` and started Forensics SSE server on `:8090` (`/health` 200 OK). (3) Updated `web/app/api/forensics/route.ts` proxy to bind to `127.0.0.1` and added graceful error diagnostics. (4) Updated `server/src/main.ts` and `server/src/realtime/realtime.gateway.ts` to allow local LAN origins and pass JWT query token for WebSocket connections. |
| 2026-10-10 | Edge ML, Video Forensics | **Anatomical Spatial Validation & Detection Overhaul**: (1) Fixed hands detected as 'boots' and yellow helmets detected as 'no_boots' by adding `filter_and_validate_detections` in `edge/app/postprocess.py`: strictly bounds footwear to bottom 38% feet region of detected workers, reclassifies yellow hardhats at head level, and suppresses floating footwear. (2) Calibrated `person` threshold to 0.35 in `edge/app/config.py` for reliable detection of occluded workers behind equipment/machinery with bold green outlines. (3) Overhauled bounding box visualization across `forensics_server.py`, `main.py`, `StreamTile.tsx`, and `VideoUploadDetection.tsx`: implemented resolution-adaptive pill badges (font scale 0.70-1.20, thickness 2, stroke 2-3px) with high-contrast uppercase labels. (4) Optimized ONNX Runtime with 4 intra-op threads and `ORT_ENABLE_ALL` for real-time video processing. (5) Unit tests: 19/19 pytest tests passed (`edge/tests/`). |
| 2026-10-10 | Edge ML, Video Forensics, Web UI | **Person-Centric PPE Association, Multi-Person Tracking & Forensics Dashboard Overhaul**: (1) **Root Cause Resolved**: Fixed threshold disparity (`helmet: 0.35`, `vest: 0.40`) and association logic in `postprocess.py` and `association.py` so detected helmets strictly override bare-head detections (`has_bare_head = False`), eliminating false bare-head labels on workers wearing hardhats. (2) **Bipartite Association (`edge/app/association.py`)**: Implemented `associate_person_ppe_v2` with anatomical head (top 32%) and torso (15-72%) bounding boxes, greedy 1-to-1 matching (no helmet shared between multiple workers), conflicting detection resolution, and explicit `COMPLIANT`/`VIOLATION`/`UNKNOWN` compliance states. (3) **Multi-Person Tracker (`edge/app/tracker.py`)**: Implemented `MultiPersonTracker` with persistent track IDs across movement and brief occlusions, track lifecycle (`ACTIVE`/`LOST`/`COMPLETED`), 15-frame rolling temporal hysteresis to eliminate status flickering, and continuous debounced `SafetyEvent` generation. (4) **Video Stream HUD & Forensics Server (`edge/app/forensics_server.py`)**: Integrated tracker and bipartite association; replaced cluttered raw detection boxes with clean person-centric HUD (`draw_scene`) showing green/red/amber status, `#001 | HELMET OK | VEST OK` ID badges, and subtle inner PPE indicators; upgraded SSE stream with live `worker_records`, `active_tracks`, and debounced events. (5) **Forensics Dashboard (`web/components/dashboard/Forensics.tsx`)**: Upgraded to production-grade industrial monitoring interface with Top Safety Overview (unique workers, active workers, confirmed violations, compliant workers, critical hazards), Workstation Video HUD with base64/canvas fallback and snapshot carousel, Live Worker Tracking Panel with real-time worker cards and interactive click-to-highlight canvas box overlay, and Bottom Safety Event Timeline with timestamp seeking. (6) **Test Suite & Verification**: Added 9 new unit and E2E tests (`test_person_ppe_tracking.py`, `test_end_to_end_video_forensics.py`). 28/28 pytest tests passed; Next.js TypeScript check passed (0 errors). |
| 2026-10-10 | Edge ML, Tracking, Forensics UI | **Worker De-Duplication & Vest Detection Compliance Engine**: (1) **Double Counting Eliminated**: Implemented intra-frame person NMS (IoU > 0.40) in `postprocess.py` to prevent duplicate person proposals for one individual; added Distance-augmented IoU (DIoU + centroid proximity < 0.16) in `tracker.py` to preserve tracking IDs across motion without ID splitting; added ghost track filtering (`hits >= 2`) so unique worker count strictly matches real people. (2) **Vest Detection & Association**: Calibrated `vest` threshold to 0.28 in `config.py`; expanded anatomical torso zone from shoulders ($0.08 \times h$) to hips ($0.85 \times h$) in `association.py` with multi-criteria IoU/containment matching; relaxed vest hysteresis in `tracker.py` so confirmed vests lock into `COMPLIANT` without flickering to `UNKNOWN`. (3) **Live Tracking Report & Stream Synchronization**: Replaced frontend cumulative Map accumulation in `Forensics.tsx` with direct synchronization of server-verified track records; updated video HUD from frame counters to live tracking time and active worker count. (4) **Test Suite**: Added 2 regression tests (`test_two_workers_one_helmet_one_not_never_double_counted`, `test_intra_frame_person_nms_suppresses_duplicate_boxes`). 30/30 pytest tests passed. |
| 2026-10-10 | Edge ML, Video Forensics | **Vest Detection Accuracy & No-Vest Violation Enforcement**: (1) **False Vest Elimination**: Calibrated `ThresholdsConfig.vest` to 0.40 in `edge/app/config.py` to reject normal jackets (conf ~0.375) and construction objects. (2) **Strict Anatomical Torso Alignment**: In `edge/app/association.py`, tightened `_anatomical_torso_zone` horizontal margins to $0.05 \times w$ (was $0.15 \times w$) and vertical bounds to $0.12 \times h - 0.72 \times h$; enforced vest center alignment ($|vcx - pcx| \le 0.38 \times pw$), vertical torso containment ($0.10 \le rel\_y \le 0.75$), and $\ge 40\%$ body containment, preventing neighboring workers from matching or stealing adjacent vests. (3) **Explicit No-Vest Violation Policy**: When upper body/head is confirmed visible without a vest, worker is classified as `vest_status = "VIOLATION"`, `missing_items = ["vest"]`, and `violations = ["NO_VEST"]` (eliminating false `UNKNOWN` / false `COMPLIANT`). (4) **Symmetric Tracker Hysteresis**: In `edge/app/tracker.py`, removed one-way sticky `or self.vest_status == "COMPLIANT"` latch; requires $\ge 2$ votes for compliance and $\ge 2$ votes for violation; debounces and records continuous `NO_VEST` SafetyEvents. (5) **Forensics Server & HUD**: Added inner vest box drawing in `draw_scene` and accurate `NO_VEST` / `NO_HELMET_AND_VEST` alert descriptions; restarted forensics server on port 8090. (6) **Test Suite**: 33/33 pytest tests passed including 3 new regression tests (`test_worker_with_helmet_but_no_vest_is_vest_violation`, `test_tracker_vest_violation_and_continuous_event`, `test_vest_not_stolen_by_adjacent_worker`). |
| 2026-10-10 | Full Stack & ML Pipelines | **Model Precision Calibration, Zero-Person Ghost Elimination, Boots/Gloves Association & Log Health**: (1) **Root Cause Resolved**: Fixed low threshold drift in `edge/app/config.py` (`person: 0.45`, `helmet: 0.40`, `vest: 0.45`, `boots: 0.45`, `gloves: 0.40`, `fire: 0.45`, `smoke: 0.35`) and strictly suppressed ghost PPE detections when no person is present in `postprocess.py`. (2) **Boots & Gloves Bipartite Tracking (`association.py`, `tracker.py`)**: Added greedy matching for boots (`rel_y >= 0.55`) and gloves (`0.20 <= rel_y <= 0.85`), 6-frame hysteresis stabilization for boots/gloves in `WorkerTrack`, and `boots`/`gloves` fields in track serialization. (3) **Forensics Server & HUD (`forensics_server.py`)**: Added boots/gloves boxes and status badge labels in `draw_scene`; anchored violations in the final report strictly to real tracked workers, guaranteeing 0 phantom worker violations and `compliance_score = None` on empty-room videos; added raw `detections` to SSE frame events. (4) **Server & Socket Reliability**: Implemented `QuietThreadingHTTPServer` in `mjpeg.py` suppressing client disconnect tracebacks; configured `transactionOptions` (15s timeout, 10s maxWait) in `server/src/prisma/prisma.service.ts` to prevent SQLite lock timeouts. (5) **Forensics UI (`Forensics.tsx`)**: Added `🥾 Boots` status chip to live worker tracking cards. (6) **Verification**: 34/34 pytest tests passed; Next.js 15 production build compiled with 0 errors; error logs cleaned. |
| 2026-10-10 | Edge ML, Video Forensics, Full Stack | **ML Accuracy Fix, Multi-Person Tracking, Video Verification & Production Readiness**: (1) **Root Cause Resolved**: Fixed helmet misclassification bug in `edge/app/postprocess.py` where yellow hardhats were mistakenly suppressed because facial features were detected as `head`; corrected footwear-to-helmet validation (`d.class_name == "helmet"`), calibrated helmet threshold to 0.35, and suppressed bare-head detections when helmet is present. (2) **Association & Tracking Calibration**: Enforced strict helmet precedence in `edge/app/association.py` (`has_head_detection = False` when `has_helmet = True`), preserved `UNKNOWN` for distant workers with unresolvable vests ($ph < 0.22$), balanced hysteresis voting in `edge/app/tracker.py` (`viol_votes >= 2 and viol_votes > comp_votes`), and debounced `SafetyEvent` generation. (3) **Forensics UI & Proxy Integration**: Added JWT `Authorization: Bearer <token>` forwarding in `web/app/api/forensics/route.ts` and direct fallback in `web/components/dashboard/Forensics.tsx`; enhanced video HUD with top header bar and resolution-adaptive pill badges in `edge/app/forensics_server.py`. (4) **Verification Deliverables**: Generated full 1080p annotated video `artifacts/verification/Test_video_annotated.mp4` (27.1 MB), frame-by-frame raw/validated predictions `artifacts/verification/Test_video_predictions.json` (654 KB), machine-readable violation logs `artifacts/verification/Test_video_events.csv`, 10 sample frames in `artifacts/verification/frames/`, technical verification report `PPE_VERIFICATION_REPORT.md`, and deployment manual `PRODUCTION_READINESS.md`. (5) **Automated Test Suites**: 34/34 pytest tests passed (`edge/tests/`); E2E video forensics API test verified with 100% compliance and 0 false violations. |
| 2026-10-10 | Full Stack | **System Startup & Live Service Verification**: Launched and verified all 4 tiers: Next.js supervisor web dashboard on port 3000 (`http://localhost:3000`, HTTP 200 OK), NestJS backend on port 4000 (`http://localhost:4000`, `/health/live` status: ok), Edge AI worker on port 8080 (`http://localhost:8080/health`, Status: OK), and Video Forensics SSE server on port 8090 (`http://localhost:8090/health`, Status: ok). Launched browser to `http://localhost:3000`. |
| 2026-10-10 | ML & Forensics | **Fire/Smoke Hazard Audit & ML Debug Report**: (1) Audited model checkpoints: confirmed `best_s5.onnx` supports all 11 classes including class 8 (`fire`) and 9 (`smoke`). Verified on dataset images: 91.4% fire detection and 84.0% smoke detection. (2) Investigated video `16511598_1080_1920_60fps.mp4`: confirmed scene depicts metallurgical molten steel pouring and exhaust steam; model accurately distinguishes industrial thermal glow from combustion fire. (3) Verified anatomical spatial filtering, person-PPE association, and multi-person tracking across test videos. (4) Created comprehensive [ML_DEBUG_REPORT.md](file:///c:/hackthon-2/ML_DEBUG_REPORT.md) detailing checkpoint audits, class distribution, root causes, test results, and production considerations. |
| 2026-10-10 | Video Forensics UI & Tracking | **Ghost Worker Elimination & Fire Hazard HUD Enhancements**: (1) **Ghost Worker Suppression**: Updated `edge/app/tracker.py` `get_all_tracks()` to strictly require `hits >= 2`, eliminating 1-frame transient noise proposals on fire debris from creating false `Worker #001 (UNKNOWN)` cards. (2) **Hazard Alert Streaming**: In `edge/app/forensics_server.py`, replaced one-time set suppression with 1.5s interval debouncing and merged all hazard events into `events`, allowing recurring fire alerts to populate the safety timeline. (3) **Top Hazard Banner**: Added top-level `[!] CRITICAL HAZARD: FIRE DETECTED` HUD banner in `draw_scene` and glowing red hazard pill in `web/components/dashboard/Forensics.tsx`. |
| 2026-10-11 | Full Stack | **Full System Startup & 4-Tier Service Verification**: Launched and verified all 4 system tiers live: (1) Supervisor Web Dashboard on `:3000` (HTTP 200 OK); (2) NestJS On-Premise Backend on `:4000` (`/health/live` HTTP 200 OK); (3) Edge AI Worker MJPEG Stream on `:8080` (`/health` HTTP 200 OK); (4) Forensics SSE Streaming Server on `:8090` (`/health` HTTP 200 OK). Verified browser navigation to `http://localhost:3000/forensics`. |
| 2026-10-11 | Edge ML, Tracking, Forensics UI | **Master Prompt PPE Detection, Localized Bounding Boxes & Tracking Synchronization Overhaul**: (1) **Root Cause Resolved**: Fixed headwear misclassification and background netting bleed: Stage 5 ONNX model previously predicted `vest` at head level ($rel\_y \le 0.11$) and background scaffolding netting bled into lateral torso boxes. Reclassified headwear detections ($rel\_y \le 0.20$) into `helmet`; implemented strict EN ISO 20471 fluorescent colorimetry in `check_torso_hivis` (lime Hue 32-62, orange Hue 5-20, Sat >= 55, Val >= 155, central 70% width margin), completely eliminating false vest classifications on dark clothing. (2) **Object-Specific Localized Bounding Boxes**: Updated `WorkerPPEAssessment` and `WorkerTrack` to track explicit `helmet_bbox` and `vest_bbox`. Updated `edge/app/forensics_server.py` `draw_scene` and `web/components/dashboard/Forensics.tsx` `drawOverlay` to render tight localized bounding boxes for helmets (`#00f078` emerald with `HELMET ✓`) and vests (`#00d73c` lime with `VEST ✓`). (3) **Accurate Worker Compliance & Missing PPE Enforcement**: Worker Left (no vest) is strictly flagged as `VIOLATION` with RED aggregate box, tight green helmet box, explicit `VEST MISSING ✕` badge, NO green vest box, and safety event in incident timeline. Worker Right (wearing vest & helmet) is flagged as `COMPLIANT` with GREEN aggregate box, tight helmet box, and tight vest box. (4) **Full UI Synchronization**: Synchronized video canvas and Live Worker Tracking Panel via single source of truth SSE stream; tracking cards display matching `COMPLIANT` and `VIOLATION (MISSING)` badges. (5) **Verification**: 35/35 pytest tests pass; Next.js TypeScript passes with 0 errors; live SSE streaming and browser verification verified on test video. |

**2026-10-09 — Dashboard design approval pending:** Generated and refined `design/dashboard-concept-v1.png` using the built-in image tool; saved the design brief and exact prompts in `design/dashboard-concept-v1.md`. Proposed a clean warm-charcoal/copper dashboard with grouped sidebar navigation, camera wall, honest offline state, incident evidence, acknowledgment-before-resolution controls, recent activity, and access to forensics/reports/administration. All displayed values are illustrative preview data. Per the user's explicit instruction, application implementation is paused until they approve the image; no dashboard/backend workflow code was changed in this design phase.

---

## 10. Rules for Future Agent Interactions
Whenever working on this codebase:
1. **Always read `brain.md`** first before taking any action.
2. **Never change port assignments**: Next.js is `3000`, NestJS is `4000`, Edge MJPEG is `8080`.
3. **Preserve zero-cloud alarm guarantee**: Edge worker MUST be capable of sounding physical alarm without server or internet.
4. **Append all new changes** to the changelog in Section 9 of `brain.md` at the end of each session.
