# Factory Safety AI — Supervisor Dashboard (`web/`)

Next.js 15 App Router frontend application designed for on-premise industrial deployment inside the factory LAN.

## Key Features
- **Live Multi-Stream Video Wall (`/wall`):** 4-stream responsive CCTV layout with real-time AI bounding boxes, FPS counters, and hazard highlight pulses.
- **Strict Severity Alert Queue (`/alerts`):** Immediate triage for `CRITICAL` (Fire/Smoke), `WARNING` (Restricted Smoking), and `COMPLIANCE` (Missing PPE).
- **Incident Inspection Drawer:** Deep-dive into incident snapshots, model confidence, temporal voting ratios (e.g. 8/10), and supervisor action notes.
- **Web Audio API Emergency Siren:** Continuous dual-tone audio alarm with browser autoplay policy unlock gate.
- **Compliance Audit History (`/history`):** Filter by sector, shift, severity, with one-click CSV export.
- **Interactive SVG Zone Editor (`/admin/zones`):** Draw normalized polygon boundaries for restricted smoking or PPE required zones.
- **Threshold & Voter Tuning (`/admin/thresholds`):** Tune detection thresholds and multi-frame temporal voting parameters.
- **Edge Node Health Telemetry (`/health`):** Real-time hardware telemetry and `report.json` benchmark acceptance gate matrix.
- **Jury Demo Scenario Controller:** One-click triggers for all presentation stages (missing helmet, yellow shirt negative test, fire breakout, network disconnect, and reconnect catch-up).
- **Multilingual Support:** English, Hindi (हिंदी), and Odia (ଓଡ଼ିଆ).

## Getting Started

### Local Development
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Standalone Production Build
```bash
npm run build
npm start
```

### Environment Variables
- `NEXT_PUBLIC_WS_URL`: WebSocket URL to backend or edge worker (defaults to built-in offline simulation mode if omitted).
- `NEXT_PUBLIC_API_URL`: On-prem backend REST endpoint.
