# AGENTS & COPILOT OPERATIONAL PROTOCOL

## 1. MANDATORY FIRST STEP: Read `brain.md`
Before answering any user question or proposing/applying code changes, you MUST read [brain.md](file:///c:/hackthon-2/brain.md) to load the accurate project context, topology, ports, credentials, and model states.
- DO NOT hallucinate endpoints, package versions, or system states.
- Respect the architectural ground truth documented in `brain.md`.

## 2. AUTOMATIC BRAIN UPDATE PROTOCOL
Whenever you complete a task, fix a bug, add a feature, or make decisions during a chat session:
1. Update Section 9 ("Recent Changes Changelog") in [brain.md](file:///c:/hackthon-2/brain.md) with a clear summary of what was done.
2. If any architectural state, credentials, ports, or model files changed, update the relevant sections of [brain.md](file:///c:/hackthon-2/brain.md) immediately.

## 3. CORE ARCHITECTURAL INVARIANTS
- **Zero Cloud Alarm Dependency**: The edge alarm (`edge/app/alarm.py`) MUST trigger locally within 10ms without waiting for the server or cloud.
- **Port Allocations**:
  - Web Dashboard: `3000` (`http://localhost:3000`)
  - On-Prem NestJS Server: `4000` (`http://localhost:4000`, `ws://localhost:4000/ws`)
  - Edge MJPEG Stream: `8080` (`http://localhost:8080`)
- **State Machine**: Alert transitions MUST use Compare-and-Swap (CAS) with version locking (`OPEN -> ACKNOWLEDGED -> RESOLVED / FALSE_ALARM`).
- **Alarm Unlatching**: Physical edge alarms are unlatched only when the supervisor acknowledges an alert and the server passes `clearAlarms` in the heartbeat response.
