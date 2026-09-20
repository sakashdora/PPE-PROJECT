# PRD: Factory Safety AI (BPUT Hackathon 2026, PS06)

**Status:** draft v1  
*Note: Numbers marked `[measure]` must come from bench / eval reports. Do not quote them until verified.*

---

## 1. Summary
**Product:** An edge-first system that watches factory camera feeds, detects fire, smoke, smoking, and missing PPE (helmet, vest, gloves, boots) in real time, and alerts the supervisor with exact failure details and location under a strict severity order (**Fire/Smoke > Smoking > PPE**).

**Why it exists (from the STPI brief):** Existing solutions are lab-optimised: generic "violation detected" alerts, cloud-dependent, fail on dust/steam/odd angles, and cause alarm fatigue.

**USP (pick and defend one or two):**
- **Corner-case robustness:** Proven with a measured false-positive table (*yellow shirt ≠ fire*, *cap ≠ helmet*, *steam ≠ smoke*).
- **Calibrated recall/precision balance:** Recall-first fire/smoke with temporal voting; precision-first PPE calibrated from empirical data.
- **Cost-effective edge deployment:** Runs on cheap CPU/edge hardware with a published cost per camera.

---

## 2. Target Users & Personas

| Persona | Needs |
| :--- | :--- |
| **Shift Supervisor (Primary)** | See critical alerts instantly, identify sector + item, acknowledge alerts, log corrections. |
| **Safety Officer** | Monitor compliance trends, identify repeat offenders by sector/shift, export compliance reports. |
| **Plant / IT Admin** | Add cameras, draw detection zones, tune sensitivity thresholds, monitor edge-node health, operate 100% cloud-free. |
| **Owner / Jury** | Low cost per camera, high uptime, verifiable proof of accuracy and false-positive suppression. |

---

## 3. Goals, Non-Goals, & Success Metrics

### Goals
- **G1:** Fire/smoke alert reaches the dashboard and triggers the alarm output without an active internet connection.
- **G2:** Every alert specifies the item and sector/camera location.
- **G3:** Supervisors are not spammed: duplicate alerts suppressed via cooldown; PPE alerts have high precision.
- **G4:** Deployable on 50 cameras with a computed, defensible cost per camera.

### Non-Goals (v1)
- Face recognition or worker identification.
- Payroll / HR integration.
- Native mobile application.
- Multi-factory multi-tenancy.
- Fully automated disciplinary action.

### Success Metrics (Gates from Eval Report)

| Metric | Target (Proposed) | Source |
| :--- | :--- | :--- |
| Fire/smoke image-level recall (clean / degraded) | ≥ 98% / ≥ 90% | `report.json` |
| PPE precision at calibrated threshold | ≥ 0.90 | `report.json` |
| Corner-case false-positive rate per folder | ≤ 2% | `report.json` |
| Camera-frame → dashboard alert latency (edge, LAN) | ≤ 1 s [measure] | End-to-end timer |
| Sustained FPS per stream on demo CPU | ≥ 10 [measure] | Bench |
| Operates with WAN unplugged | Yes | Live Demo |
| Duplicate alerts per 10-min event | ≤ 1 (cooldown) | Test |

---

## 4. Scope by Release

| Release | Contents |
| :--- | :--- |
| **MVP (Hackathon Demo)** | 3–4 video files as "cameras", detection + voting, alert queue with severity, sector tagging, live multi-stream wall, acknowledge action, alarm output (simulated relay/buzzer), offline demo, metrics presentation. |
| **v1** | RTSP camera ingestion, zone polygons (restricted smoking zones), reports/CSV export, role-based access, edge health monitoring, snapshot retention policy, model version management. |
| **Later** | Tracker-based repeat-offender stats, PLC/Modbus integration, WhatsApp/SMS alerts, multi-site cloud rollup, active-learning loop (supervisor marks false alarm → added to retraining set). |

---

## 5. Functional Requirements
*Priority: **M** = Must (MVP), **S** = Should (v1), **C** = Could.*

| ID | Requirement | Priority |
| :--- | :--- | :---: |
| **FR-1** | Ingest ≥ 4 simultaneous streams (files or RTSP), auto-reconnect on drop | **M** |
| **FR-2** | Run detector locally (ONNX/OpenVINO); load thresholds from `thresholds.json` | **M** |
| **FR-3** | Temporal voting per stream/class (fire 2/5, PPE 8/10 frames, configurable) | **M** |
| **FR-4** | Person-level PPE association (bare head / no_gloves / no_boots inside person box; vest absent on person) | **M** |
| **FR-5** | Alert payload names item, camera, sector, timestamp, confidence, snapshot | **M** |
| **FR-6** | Severity hierarchy and actions: **CRITICAL** (fire/smoke), **WARNING** (smoking in zone), **COMPLIANCE** (PPE) | **M** |
| **FR-7** | CRITICAL alerts sit on top of the queue, sound an alarm, and stay until manually cleared | **M** |
| **FR-8** | Cooldown/dedup: same (camera, type, item) suppressed for $N$ seconds unless severity rises | **M** |
| **FR-9** | Live wall: $N$ streams on one screen with overlay boxes and a red border on critical cameras | **M** |
| **FR-10** | Acknowledge / resolve / mark false alarm with an attached note | **M** |
| **FR-11** | Alarm output adapter: GPIO/relay, MQTT topic, or webhook | **S** |
| **FR-12** | Zone editor (polygon per camera); smoking counts only inside restricted zones | **S** |
| **FR-13** | History, filters (sector/shift/type), CSV/PDF export, per-sector trend chart | **S** |
| **FR-14** | Admin: cameras, sectors, thresholds, voter params, users/roles | **S** |
| **FR-15** | Edge health: FPS, latency, temperature/CPU, last-seen per camera | **S** |
| **FR-16** | Model registry: active model version recorded on every alert | **S** |
| **FR-17** | False-alarm marks exported as a retraining set | **C** |

---

## 6. Non-Functional Requirements

- **Reliability:** Alarm path (camera → edge → dashboard → relay) must function without internet access. Cloud is strictly optional for synchronization.
- **Latency:** Local processing only; no raw video leaves the LAN.
- **Bandwidth:** Transmit metadata + one snapshot per alert, never continuous raw video over WAN.
- **Privacy:** No face recognition; optional face-blur on stored snapshots; snapshot retention configurable (default 30 days); role-based access; audit log for acknowledgements.
- **Security:** Authenticated API and WebSocket, hashed passwords, encrypted camera credentials, TLS on LAN if exposed, model integrity verification.
- **Scalability:** Horizontal scaling via additional edge nodes; each node serves $\lfloor \text{node\_FPS} / \text{target\_FPS\_per\_camera} \rfloor$ cameras [measure].
- **Observability:** Structured logs, `/health` endpoint, per-stream FPS/latency metrics.
- **Licence:** Ultralytics YOLO is AGPL-3.0. Document compliance and identify the commercial path (enterprise license or a permissive detector like Apache-2.0).

---

## 7. Architecture

### Stack
- **Dashboard:** Next.js
- **Server:** NestJS / Express + Prisma + PostgreSQL (Redis optional for pub/sub)
- **Edge Worker:** Python (inference via ONNX / OpenVINO)
- **Deployment Principle:** On-prem server + dashboard run inside factory LAN. Never host the alarm path in the cloud.

### Data Flow Diagram
```
Cameras / RTSP / Files
       │
       ▼
Edge worker: stream reader
       │
       ▼
Inference ONNX / OpenVINO
       │
       ▼
Post-process: thresholds, person association, temporal vote, cooldown
       │
       ├─────────────────────────────────────────┐
       ▼                                         ▼
SQLite outbox on edge                   Alarm adapter (direct)
       │ (HTTP/WebSocket, retry)                 │ (Relay / MQTT / Buzzer)
       ▼                                         ▼
On-prem API (NestJS / Express)             CRITICAL ALARM
       │
       ├──► PostgreSQL
       │
       └──► WebSocket ──► Next.js Dashboard
                               │
                               ▼ (Optional metadata only)
                          Cloud Rollup
```

### Key Decisions
1. **Outbox Pattern on Edge:** Alerts are written to local SQLite first, then delivered to the server. Server outages or restarts never lose fire alerts.
2. **Direct Edge Alarm Trigger:** Alarm adapter fires directly from the edge worker for CRITICAL events, bypassing server/network points of failure.
3. **Low-Bandwidth Video Wall:** Edge serves low-res annotated MJPEG/WebRTC streams on LAN; dashboard embeds them. Raw video is not persistently stored.
4. **Downstream Config Sync:** Server publishes cameras, zones, thresholds, and voter parameters. The edge polls or subscribes and hot-reloads.

### Alert Schema (Edge → Server)
```json
{
  "id": "uuid",
  "ts": "2026-09-20T10:15:32.412+05:30",
  "camera_id": "cam-04",
  "sector": "Sector 4",
  "zone_id": "z-smoking-restricted",
  "severity": "CRITICAL | WARNING | COMPLIANCE",
  "type": "fire | smoke | smoking | missing_ppe",
  "items": ["helmet"],
  "confidence": 0.87,
  "votes": "3/5",
  "model_version": "ppe_v1_s2",
  "snapshot_path": "snapshots/2026/09/20/uuid.jpg",
  "bbox": [x1, y1, x2, y2]
}
```

### Severity Matrix
| Severity | Events | Action | Error Tolerance |
| :--- | :--- | :--- | :--- |
| **CRITICAL** | Fire, Smoke | Top of queue, alarm output, sticky until manually cleared | Zero missed; false alarms acceptable |
| **WARNING** | Smoking in restricted zone | Immediate supervisor notification with location | Low misses |
| **COMPLIANCE** | Missing helmet / vest / gloves / boots | Logged, supervisor notified, batched in end-of-shift report | High precision |

---

## 8. API Specifications (REST + WebSocket)

| Endpoint | Method | Purpose |
| :--- | :---: | :--- |
| `/edge/alerts` | `POST` | Edge posts alert (idempotent on `id`) |
| `/edge/heartbeat` | `POST` | Reports FPS, latency, per-camera status |
| `/edge/config` | `GET` | Fetch cameras, zones, thresholds, voter params, active model |
| `/alerts` | `GET` | Queue and history (`?status=&severity=&sector=&from=&to=`) |
| `/alerts/:id` | `PATCH` | Acknowledge / resolve / false_alarm + note |
| `/cameras`, `/sectors`, `/zones` | `GET`/`POST` | Admin CRUD |
| `/reports/compliance` | `GET` | Compliance reports (`?from=&to=&format=csv`) |
| `/stream/alerts` | `WS` | WebSocket pushing real-time alerts to dashboard |
| `/auth/login` | `POST` | JWT Authentication |

---

## 9. Data Model (Prisma Sketch)
- `Site` → `Sector` → `Camera` → `Zone` (polygon, kind)
- `Alert` (id, ts, camera_id, sector, zone_id, severity, type, items[], confidence, votes, modelVersion, snapshotPath, status, ackBy, ackAt, note)
- `User` (id, email, passwordHash, role)
- `AuditLog` (id, timestamp, userId, action, details)
- `ModelVersion` (id, name, metricsJson, thresholdsJson, active)
- `EdgeNode` (id, hostname, lastSeen, fps, latency)

---

## 10. Dashboard Screens
1. **Live Wall:** Grid of streams, per-camera status chip, red border + audible alarm on critical alerts.
2. **Alert Queue:** Sticky critical alerts on top; card displays "Sector 4, cam-04: missing gloves", snapshot, timestamp, Acknowledge / False alarm actions.
3. **History & Reports:** Granular filters, sector/shift violation heatmap, CSV export.
4. **Admin Panel:** Camera list, interactive zone polygon editor, threshold and voter sliders (with warning: *"Lowering fire threshold increases false alarms"*), user management.
5. **Model & Edge Health:** Active model version, `report.json` benchmark metrics, per-node FPS and latency telemetry.

---

## 11. Repository Structure
```
factory-safety-ai/
├── README.md                    # 1-page quickstart + demo script
├── docs/
│   ├── PRD.md                   # Product requirements document
│   ├── TRAINING_GUIDE.md        # Training pipeline & data curation guide
│   ├── ARCHITECTURE.md          # Architectural blueprints & latency budgets
│   ├── SECURITY.md              # LAN security, auth, snapshot privacy
│   ├── RUNS_LOG.md              # Model run evaluation history
│   └── diagrams/
├── ml/                          # Model & evaluation pipelines
│   ├── safety_pipeline.py
│   ├── sources.yaml
│   ├── requirements.txt
│   ├── report/
│   ├── thresholds.json
│   ├── report.json
│   └── models/                  # .pt / .onnx / OpenVINO (git-ignored, pointer file)
├── edge/                        # Python edge worker
│   ├── app/
│   │   ├── main.py              # Stream orchestration
│   │   ├── stream.py            # RTSP / file reader, auto-reconnect
│   │   ├── infer.py             # ONNX / OpenVINO runtime
│   │   ├── postprocess.py       # Thresholds, PPE violations, TemporalVoter, cooldown
│   │   ├── alarm.py             # Relay / MQTT / webhook adapters
│   │   ├── outbox.py            # SQLite outbox + retry mechanism
│   │   ├── mjpeg.py             # Annotated preview stream server
│   │   └── config.py            # Pulls /edge/config, hot-reloading
│   ├── tests/                   # Unit tests (voter, association, cooldown, outbox)
│   └── Dockerfile
├── server/                      # NestJS / Express + Prisma backend
│   ├── src/                     # alerts, cameras, zones, auth, reports, edge, ws
│   ├── prisma/schema.prisma
│   └── Dockerfile
├── web/                         # Next.js frontend dashboard
│   ├── app/                     # wall, alerts, history, admin, health
│   ├── components/              # StreamTile, AlertCard, ZoneEditor, SeverityBadge
│   └── Dockerfile
├── infra/
│   ├── docker-compose.yml       # postgres, redis, server, web, edge
│   └── .env.example
├── demo/
│   ├── videos/                  # 3-4 clips: fire, missing PPE, corner cases, smoking
│   └── script.md                # Step-by-step jury walkthrough script
└── scripts/                     # Seed data, false-alarm export
```

---

## 12. Test Plan
- **Unit Testing:** Temporal voter logic, person-item association, cooldown/dedup windows, outbox retry semantics.
- **Integration Testing:**
  - Kill server mid-alert (alert buffered in SQLite and delivered upon recovery).
  - Unplug WAN cable (local inference, dashboard, and buzzer/relay alarm remain 100% operational).
  - Camera drop and auto-reconnect recovery.
- **ML Acceptance:** Gate checks against Section 3 metrics using `report.json`.
- **Soak Testing:** 30-minute sustained run across all streams without memory leaks or FPS degradation.
- **Demo Rehearsal:** Run walkthrough twice with external teammate.

---

## 13. Unit Economics
$$\text{cameras\_per\_node} = \left\lfloor \frac{\text{node\_sustained\_FPS}}{\text{target\_FPS\_per\_camera}} \right\rfloor$$
$$\text{capex\_per\_camera} = \frac{\text{node\_cost} + \text{install\_cost}}{\text{cameras\_per\_node}}$$
$$\text{opex\_per\_camera} = \text{power} + \text{maintenance} + \text{optional\_cloud\_sync}$$
$$\text{cloud\_alt\_per\_cam} = (\text{egress\_GB\_per\_month} \times \text{price}) + \text{cloud\_inference\_cost}$$

*Compare edge vs. cloud TCO for 50 cameras backed by benchmarked FPS and real hardware pricing.*

---

## 14. Risks & Mitigations

| Risk | Mitigation |
| :--- | :--- |
| Public data does not generalize to target factory | Own labeled test set; document domain gap honestly |
| Fire false alarms at low threshold | Temporal voting (2/5 frames), hard negatives, flicker check, report FAR |
| Small objects (gloves/boots/cigarettes) at 640px | 960px test evaluation, secondary crop-classifier fallback |
| GPU quota / disconnect issues | Checkpoints synced to Drive, Kaggle background commit runs |
| AGPL license implications | State licensing clearly; provide commercial migration path to permissive models |
| Live demo failure | Offline local fallback clips, pre-recorded backup video |

---

## 15. Team Roles (3–4 People)
- **ML Lead:** Data merge, training, evaluation, error-driven iteration, model export.
- **Edge Engineer:** Streams, inference runtime, post-processing, SQLite outbox, alarm adapter.
- **Backend & DB Engineer:** API endpoints, Prisma schema, WebSocket gateway, auth, reporting.
- **Frontend & Demo Lead:** Next.js live wall, alert queue, admin UI, demo script, slides.

---

## 16. Demo Script (5 Minutes)
1. **Problem & USP (30s):** Introduce false alarm fatigue, cloud failure modes, and edge robustness.
2. **Live Wall (60s):** 4 streams active; worker without helmet triggers "Sector 4: missing helmet".
3. **Corner Cases (60s):** Yellow shirt and cap stay silent; steam does not trigger smoke. Show FPR table.
4. **Fire Clip (45s):** CRITICAL alert jumps to the top; physical/simulated buzzer triggers immediately.
5. **Unplug Network (45s):** Pull ethernet cable; show system continuing uninterrupted on local LAN.
6. **Unit Economics & FPS (45s):** Show edge vs. cloud 50-camera cost breakdown and bench FPS.
7. **Q&A, Licensing & Roadmap (15s):** AGPL discussion, roadmap features.

---

## 17. Open Questions
1. **Camera Ingestion:** Which real cameras / RTSP streams or pre-recorded benchmark files will be used for the final demo?
2. **Alarm Hardware:** Physical alarm output via GPIO/relay/buzzer, or virtual audio/visual simulation on stage?
3. **Localization:** Is bilingual (English / Odia / Hindi) alert messaging required for factory floor supervisors?
4. **Submission Format:** What is the hackathon's exact submission package requirement (GitHub repo, presentation deck, recorded video, live booth demo)? Fit the milestones to it.
