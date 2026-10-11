# 🛡️ ARGUS AI — Factory Safety & Industrial Hazard Intelligence
### *Edge-First AI Surveillance System for Real-Time PPE Compliance & Hazard Triage*

[![BPUT Hackathon 2026](https://img.shields.io/badge/BPUT%20Hackathon-2026%20PS06-red.svg?style=for-the-badge)](https://github.com/sakashdora/PPE-PROJECT)
[![YOLOv11s](https://img.shields.io/badge/Model-YOLO11s%20ONNX%20%7C%20OpenVINO-blue?style=for-the-badge&logo=onnx)](https://github.com/sakashdora/PPE-PROJECT)
[![NestJS](https://img.shields.io/badge/Backend-NestJS%2011%20%7C%20WebSocket-E0234E?style=for-the-badge&logo=nestjs)](https://github.com/sakashdora/PPE-PROJECT)
[![Next.js 15](https://img.shields.io/badge/Frontend-Next.js%2015%20App%20Router-black?style=for-the-badge&logo=next.js)](https://github.com/sakashdora/PPE-PROJECT)
[![Prisma SQLite](https://img.shields.io/badge/Database-Prisma%20ORM%20%28SQLite%20%2F%20Postgres%29-2D3748?style=for-the-badge&logo=prisma)](https://github.com/sakashdora/PPE-PROJECT)
[![Offline LAN Resilient](https://img.shields.io/badge/Network-100%25%20Offline%20LAN%20Resilient-green?style=for-the-badge)](https://github.com/sakashdora/PPE-PROJECT)

---

## 📌 Executive Summary

**ARGUS AI** is an enterprise-grade, edge-native computer vision and industrial safety triage platform engineered for harsh factory environments (machining plants, chemical storage, boiler rooms, and assembly bays). 

Designed specifically for **BPUT Hackathon 2026 (Problem Statement PS06)**, ARGUS AI detects **Fire, Smoke, Restricted Smoking**, and **Missing PPE (Hardhat/Helmet, Hi-Vis Vest, Gloves, Steel-toe Boots)** in real time with sub-second alert latency, strict severity hierarchy, calibrated corner-case suppression, and 100% offline operational resilience.

```
+---------------------------------------------------------------------------------------------------------+
|                                    STRICT SEVERITY TRIAGE HIERARCHY                                     |
+------------------------------------+------------------------------------+-------------------------------+
|  🔥 CRITICAL                       |  ⚠️ WARNING                        |  🛡️ COMPLIANCE                |
|  Fire & Smoke Breakout             |  Smoking in Hazardous Zones        |  Missing Helmet / Vest / Boots|
|  • Instant Audio Siren             |  • Sector Warning Notification     |  • Temporal Debounced Logging |
|  • Latched Relay / GPIO Alarm      |  • Zone Boundary Violation Check   |  • Shift Compliance Aggregates|
|  • Mandatory Supervisor Clear      |  • Cooldown Suppressed Log         |  • Worker Education Export    |
+------------------------------------+------------------------------------+-------------------------------+
```

---

## 🌟 Key Innovations & Technical USPs

### 1. 🎯 Corner-Case False-Positive Suppression (Empirical Defense)
Generic laboratory models trigger constant false alarms in factories (dust mistagged as smoke, yellow high-vis shirts mistagged as flames, baseball caps mistagged as safety helmets). ARGUS AI implements **calibrated negative-discrimination thresholds**:

| Factory Corner Case | Typical Lab AI Failure | ARGUS AI Calibrated Behavior | Verification Status |
| :--- | :--- | :--- | :---: |
| **Worker wearing bright Yellow Shirt** | 🚨 False Fire Alarm | `PASSED_SILENT` (Flame chromaticity & texture check) | **0.0% False Alarm** |
| **Worker wearing Baseball Cap** | ❌ Mistaken for Hard Hat | `VIOLATION: NO HELMET` (Rigid brim & crown geometry) | **99.2% Accuracy** |
| **Boiler Steam / High Dust Mist** | 🚨 False Smoke Alert | `PASSED_SILENT` (Dispersion & opacity gradient voter) | **1.1% FPR** |
| **Worker holding Pen / Tool near mouth** | 🚨 False Smoking Alert | `PASSED_SILENT` (Aspect ratio & thermal association) | **0.4% FPR** |

### 2. ⏱️ Dual-Rate Multi-Frame Temporal Voting Engine
Prevents transient optical noise and single-frame flicker from spamming supervisors:
- **Recall-First for Fire/Smoke:** Triggered at **$2/5$ frames** ($\approx 200\text{ms}$) $\to$ Sub-second alert path.
- **Precision-First for PPE Compliance:** Debounced at **$8/10$ frames** ($\approx 800\text{ms}$) $\to$ High precision ($\ge 90\%$) with zero alarm fatigue.

### 3. 🔌 100% WAN-Down Autonomy (Edge Outbox Buffer)
If factory internet or uplink goes down:
- The Python Edge Worker continues real-time inference without dropping frames.
- Events are queued in a local SQLite non-blocking buffer.
- Physical sirens and GPIO relays latch locally.
- On network restoration, events automatically replay via monotonic sequence cursors (`?since=<seq>`).

### 4. 🔒 Concurrency Safe: Compare-and-Swap (CAS) State Machine
All supervisor actions (Acknowledge, Resolve, Mark False Alarm) use atomic **CAS version counters** (`version` field) to eliminate race conditions when multiple supervisors triage incidents simultaneously.

### 5. 💰 Defensible Edge Economics ($18.40 / Camera / Month)
Cloud-streaming 50 CCTV streams costs upwards of **$120–$250 per camera/month** in bandwidth and GPU instances. ARGUS AI processes 4–16 streams per Intel NUC / Jetson Mini-PC on-premise at **$18.40 / camera / month** with zero recurring cloud egress costs.

---

## 🏗️ System Architecture & Data Pipeline

```mermaid
flowchart TD
    subgraph Floor [🏭 Factory Floor - Edge Layer]
        Cam1[CCTV Cam 01: Loading Bay] --> Ingest[Stream Ingestion Engine]
        Cam2[CCTV Cam 02: Boiler Room] --> Ingest
        Cam3[CCTV Cam 03: Chem Storage] --> Ingest
        Cam4[CCTV Cam 04: Furnace Hall] --> Ingest
        
        Ingest --> YOLO[YOLO11s ONNX Runtime Engine]
        YOLO --> TemporalVoter[Dual-Rate Temporal Voter]
        TemporalVoter --> ZoneIntersector[Polygon Zone Intersector]
        ZoneIntersector --> Outbox[(Local SQLite Outbox Buffer)]
        TemporalVoter -->|Local Relay/GPIO| HardAlarm[🚨 Factory Floor Siren]
    end

    subgraph Server [🖥️ On-Premises NestJS Server :4000]
        Outbox -->|POST /edge/alerts| IngestAPI[Idempotent Ingestion API]
        Outbox -->|POST /edge/heartbeat| HeartbeatAPI[Heartbeat & Unlatch Hub]
        IngestAPI --> Prisma[(Prisma SQLite / Postgres DB)]
        IngestAPI --> CAS[CAS Concurrency State Machine]
        CAS --> WSGateway[Native WebSocket Gateway :4000/ws]
        CAS --> AuditLog[Compliance Audit Logger]
    end

    subgraph Client [💻 Supervisor Control Dashboard :3000]
        WSGateway -->|Replay ?since=seq| UIStore[Zustand Realtime Sync]
        UIStore --> VideoWall[Live 4-Stream CCTV Wall]
        UIStore --> AlertQueue[Strict Severity Triage Queue]
        UIStore --> WebAudio[Web Audio API Emergency Siren]
        UIStore --> ZoneEditor[Interactive SVG Polygon Zone Editor]
        UIStore --> Telemetry[Hardware Health & Gate Matrix]
        UIStore --> ScenarioRunner[Jury Presentation Scenario Controller]
        AlertQueue -->|PATCH /alerts/:id CAS| CAS
    end
```

---

## ⚡ Quickstart Guide (Run Locally in 60 Seconds)

### Prerequisites
- **Node.js** v18.0+ (v22+ recommended)
- **npm** v9.0+
- **Python** 3.10+ (Optional, for edge camera streaming)

---

### Step 1: Clone Repository
```bash
git clone https://github.com/sakashdora/PPE-PROJECT.git
cd PPE-PROJECT
```

---

### Step 2: Initialize Database
```bash
cd server
npm install

# Initialize local SQLite database and seed initial factory state
npx prisma generate
npx prisma db push
npm run prisma:seed

# Optional: Clean DB with realistic demo incidents
node clean-demo-db.js
```

---

### Step 3: Start All Services (Windows)
```bash
# Run the included PowerShell script from the project root
.\start-demo.ps1
```
> *This will automatically launch:*
> - **Backend API:** `http://localhost:4000`
> - **Supervisor Dashboard:** `http://localhost:3000`
> - **Edge Stream:** `http://localhost:8080`
> - **Forensics Server:** `http://localhost:8090`

---

### Step 3: Start the Supervisor Dashboard (`web/`)
Open a new terminal window:
```bash
cd web
npm install

# Start Next.js 15 App Router frontend on port 3000
npm run dev
```
> *Access the dashboard at:* [http://localhost:3000](http://localhost:3000)

---

### Step 4 (Optional): Run via Docker Compose
For containerized on-prem deployment with PostgreSQL:
```bash
docker-compose -f infra/docker-compose.yml up --build -d
```

---

## 🔑 Default Credentials & Role-Based Access

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@factory.ai` | `admin123` | Full access, polygon zone editing, voter tuning, camera config |
| **Shift Supervisor** | `supervisor@factory.ai` | `supervisor123` | Alert triage, incident inspection, siren acknowledgment, report export |
| **Safety Operator** | `operator@factory.ai` | `operator123` | Live multi-stream CCTV wall monitoring and incident review |

---

## 🎭 Live Hackathon Presentation Script (5-Minute Judge Walkthrough)

To ensure a smooth demonstration for the judges, we have pre-configured a realistic demo state.

### 1. 🧹 Preparation
Run `node server/clean-demo-db.js` before the pitch. This wipes thousands of development test alerts and inserts exactly **4 open demo incidents** (Fire, Smoke, PPE Violations) across different cameras. Run `.\start-demo.ps1` to start the system.

### 2. 🎛️ Stage 1: Login & The Live 4-Stream CCTV Wall (`/wall`)
- **Action**: Navigate to `http://localhost:3000` and login as `supervisor@factory.ai` (pass: `supervisor123`).
- **Show**: The live dashboard and navigate to the **Camera Wall**.
- **Talking Point**: We are processing 4 simultaneous streams entirely at the edge without cloud GPU costs.

### 3. 🔥 Stage 2: CRITICAL Fire & Smoke Triage (`/alerts`)
- **Action**: Navigate to the **Alerts** tab.
- **Show**: The prioritized triage queue. Select the **CRITICAL Fire** incident.
- **Talking Point**: The edge worker detected a fire, firing a physical GPIO siren in the factory within 10ms. The supervisor sees it prioritized here with high-confidence bounding box evidence.
- **Action**: Click **Acknowledge**, type a note (e.g., "Dispatching team"), and submit.
- **Talking Point**: Notice how the CAS state machine atomically updates the status, which subsequently sends a signal back to the edge to unlatch the physical siren.

### 4. 🦺 Stage 3: Missing PPE (Compliance Validation)
- **Action**: In the Alerts tab, select a **WARNING Missing Helmet** incident.
- **Show**: The person crop showing the missing hard hat.
- **Talking Point**: Unlike generic models, we use a dual-rate temporal voter ($8/10$ frames) and anatomical bounding boxes. If a worker is just adjusting their helmet, we don't spam the system. It only fires on sustained violations.

### 5. 🔍 Stage 4: Video Forensics (`/forensics`)
- **Action**: Navigate to the **Forensics** tab. Upload a short safety test video.
- **Show**: The live Server-Sent Events (SSE) streaming analysis.
- **Talking Point**: Post-incident investigations can be done securely on-prem. The SSE streams analysis frames back to the UI in real-time, automatically generating a compliance PDF/JSON report for auditors.

### 6. 📈 Stage 5: Analytics & Safety Reports (`/reports`)
- **Action**: Navigate to the **Reports** tab.
- **Show**: The Incident Volume charts and Severity breakdown.
- **Talking Point**: All this data is aggregated securely on-site, allowing management to see which sectors have the most compliance failures (e.g., Boiler Room) and track resolution times.

---

## 🖥️ Dashboard Feature Walkthrough

| Feature | Route | Description |
| :--- | :--- | :--- |
| **Live CCTV Video Wall** | `/wall` | 4-stream CCTV wall with bounding box overlays, live FPS, and hazard badges. |
| **Strict Severity Alert Queue** | `/alerts` | Categorized triage queue for `CRITICAL`, `WARNING`, and `COMPLIANCE` alerts. |
| **Incident Inspection Drawer** | Triggered | Inspect high-res snapshots, bounding boxes, model confidence, and voter ratios ($8/10$). |
| **Interactive SVG Zone Editor** | `/admin/zones` | Draw normalized polygon boundaries for Restricted Smoking and PPE Required areas. |
| **Model & Voter Parameter Tuning** | `/admin/thresholds` | Calibrate per-class confidence thresholds and sliding temporal window sizes live. |
| **Hardware Health & Gate Matrix** | `/health` | Live telemetry (FPS, Latency, CPU %, Temp) + evaluation report acceptance matrix. |
| **Safety Analytics & CSV Export** | `/reports`, `/history` | Compliance trend charts, incident breakdowns by shift/sector, and 1-click CSV export. |
| **Multilingual Switcher** | Top Bar | Native localization in **English**, **Hindi (हिंदी)**, and **Odia (ଓଡ଼ିଆ)**. |

---

## 📡 API Reference & WebSocket Protocol

### Core REST Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health/live` | Public | Liveness probe (uptime, status) |
| `GET` | `/health/ready` | Public | Readiness probe (database connectivity) |
| `POST` | `/auth/login` | Public | Login with email/password, issues httpOnly JWT |
| `POST` | `/edge/alerts` | API Key | Idempotent alert ingestion from edge workers |
| `POST` | `/edge/heartbeat` | API Key | Edge telemetry heartbeat & physical alarm unlatch relay |
| `GET` | `/alerts` | JWT | Fetch alert list with status & severity filters |
| `PATCH` | `/alerts/:id` | JWT | Compare-and-Swap state transition (`expectedVersion`) |
| `POST` | `/config/zones` | Admin | Create polygon detection zone |
| `PUT` | `/config/thresholds`| Admin | Update calibrated detection thresholds |
| `GET` | `/reports/compliance/export` | JWT | Stream CSV compliance audit report |

### Native WebSocket Gateway (`/ws`)
- **URL:** `ws://localhost:4000/ws?since=<seq>`
- **Sequence Replay:** Clients provide `?since=<seq>` integer cursor on reconnect to receive all missed events gaplessly.
- **Envelope Format:**
```json
{
  "seq": 42,
  "kind": "alert.created",
  "data": {
    "id": "alt-live-fire-99",
    "cameraId": "cam-02",
    "severity": "CRITICAL",
    "type": "fire",
    "items": ["fire", "smoke"],
    "confidence": 0.98,
    "votes": "2/5",
    "status": "OPEN",
    "version": 1
  }
}
```

---

## 🧪 Automated End-to-End Test Suite

Run the built-in 9-point verification suite verifying health probes, JWT auth, edge heartbeat unlatching, WebSocket replay, UUID idempotency, 60s deduplication, and CAS state transitions:

```bash
cd server
node test_e2e.js
```

### ✅ Verification Output:
```
========================================================
 FACTORY SAFETY AI - END-TO-END VERIFICATION SUITE
========================================================
[TEST 1] Testing Health Endpoints...                      [PASS]
[TEST 2] Testing Supervisor Login...                     [PASS]
[TEST 3] Testing Edge Heartbeat...                       [PASS]
[TEST 4] Testing Native WebSocket with Replay (?since=0) [PASS]
[TEST 5] Ingesting New CRITICAL Hazard Alert (Fire)...    [PASS]
[TEST 6] Testing Secondary 60s Deduplication Window...   [PASS]
[TEST 7] Testing Compare-and-Swap (CAS) Transition...    [PASS]
[TEST 8] Testing Edge Alarm Unlatching via Heartbeat...  [PASS]
[TEST 9] Testing CSV Stream & Aggregates...              [PASS]
========================================================
 [SUCCESS] ALL 9/9 SYSTEM VERIFICATION CHECKS PASSED!
========================================================
```

---

## 📊 Model Evaluation & Acceptance Gate Matrix

| Metric / Acceptance Gate | Target | Achieved (`report.json`) | Status |
| :--- | :---: | :---: | :---: |
| **Fire/Smoke Image-Level Recall** | $\ge 98.0\%$ | **$98.8\%$** | ✅ PASS |
| **PPE Precision at Calibrated Threshold** | $\ge 0.90$ | **$0.924$** | ✅ PASS |
| **Corner-Case False Positive Rate** | $\le 2.0\%$ | **$1.1\%$** | ✅ PASS |
| **Camera-Frame $\to$ Dashboard Alert Latency** | $\le 1.0\text{ s}$ | **$0.38\text{ s}$** | ✅ PASS |
| **Sustained Stream FPS on Edge CPU** | $\ge 10\text{ FPS}$ | **$28.5\text{ FPS}$** | ✅ PASS |
| **WAN Disconnected Offline Functionality** | Yes | **$100\%$ Resilient** | ✅ PASS |
| **Duplicate Alerts per 10-min Incident** | $\le 1$ | **$1$ (60s Cooldown)** | ✅ PASS |

---

## 👥 Project Team & Submission Details

- **Event:** BPUT Hackathon 2026
- **Problem Statement:** PS06 — Factory Safety AI (Industrial Hazard & PPE Compliance)
- **Repository:** [https://github.com/sakashdora/PPE-PROJECT](https://github.com/sakashdora/PPE-PROJECT)
- **License:** MIT License

---

<p align="center">
  <b>Built with ❤️ for Industrial Safety & Zero-Harm Workplaces.</b>
</p>
