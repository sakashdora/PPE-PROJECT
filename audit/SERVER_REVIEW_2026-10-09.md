# Backend review — 9 October 2026

Scope: all source under `server/src`, both Prisma schemas, the seed and existing E2E script, backend packaging, and the edge/web contracts they consume. `brain.md` and `AGENTS.md` were read first. This is an analysis: application code and the application database were not changed.

The SQLite backend passes its TypeScript check, but several core behaviors are broken. The most consequential verified defects are disconnected event buses, deduplicated alert IDs that cannot be cleared at the edge, bypassable CAS validation, an unauthenticated WebSocket, and a PostgreSQL deployment build that fails with 17 type errors.

## 1. Backend execution and data flow

1. `main.ts` creates Nest, installs the native WS adapter and cookie parser, enables dashboard CORS, then listens on `PORT` or 4000. There is no global `ValidationPipe`.
2. `PrismaService` connects on module initialization. SQLite is the development schema. The Dockerfile explicitly generates the different PostgreSQL schema.
3. Login looks up an email, checks bcrypt, issues a seven-day JWT containing user identity and role, writes an audit row, and sets an HTTP-only cookie. Other HTTP requests can use that cookie or a Bearer token.
4. Edge authentication hashes the incoming API key and looks up a node. A configured/default shared-key fallback also grants access even without a matching database node.
5. Alert ingestion normalizes a few snake_case aliases, checks the edge UUID, searches for a matching OPEN/ACKNOWLEDGED incident seen within the last 60 seconds, then either increments the existing incident or creates a new row and optional snapshot. It subsequently inserts an `AlertEvent` and emits an event.
6. Alert transitions use `updateMany` with ID, version and permitted status, and insert both the event and audit row in the same transaction. This works as a CAS only when a valid `expectedVersion` is actually supplied.
7. Heartbeats update node telemetry, mark listed cameras online, query all acknowledged/resolved/false-alarm IDs for that node, and return `clearAlarms` plus the config version.
8. Edge configuration reads enabled cameras/zones, the first active model and config state. The controller computes an ETag and supports `If-None-Match`.
9. The gateway adds clients to a subscriber set, optionally queries up to 1,000 replay events, sends replay records, then handles application ping messages. It also broadcasts a ping every five seconds. Live producers currently have different event-bus instances from the gateway.
10. Every five seconds, the health job marks previously-online nodes offline after 20 seconds and cameras stalled after 15 seconds. It creates an incident for a timed-out node if a camera exists. Recovery heartbeats update rows but do not broadcast recovery telemetry.
11. Reports load matching alerts into memory and construct CSV. Aggregates return `totalAlerts` and OPEN counts grouped by severity.
12. The midnight retention job deletes `AlertEvent` records older than 90 days. It does not remove snapshots, alert rows or audit logs.

## 2. Endpoint and permission inventory

| Surface | Operations | Effective access |
|---|---|---|
| Authentication | `POST /auth/login`, `POST /auth/logout` | Public; logout clears the cookie |
| Current user | `GET /auth/me` | JWT; returns token payload |
| Edge | `POST /edge/alerts`, `POST /edge/heartbeat`, `GET /edge/config` | Edge API-key guard |
| Alert reads | `GET /alerts`, `GET /alerts/:id`, `GET /alerts/:id/snapshot` | Any valid JWT role |
| Alert transition | `PATCH /alerts/:id` | SUPERVISOR or ADMIN |
| Configuration reads | `GET /config/cameras`, `GET /config/models` | Any valid JWT role |
| Camera update | `PATCH /config/cameras/:id` | ADMIN |
| Zone update | `POST /config/zones`, `DELETE /config/zones/:id` | ADMIN |
| Tuning | `PUT /config/thresholds`, `PUT /config/params` | ADMIN |
| Model activation | `POST /config/models/:id/activate` | ADMIN |
| Reports | `GET /reports/compliance` | SUPERVISOR or ADMIN |
| Aggregates | `GET /reports/aggregates` | Any valid JWT role |
| Health | `GET /health/live`, `GET /health/ready` | Public |
| Realtime | `/ws`, optional `?since=<seq>` | No authentication or Origin validation |

`GET /alerts` only binds status, severity, cameraId, limit and cursor. The service contains date filtering but the controller never forwards `from` or `to`. There are no user-administration, site/sector-management, camera-creation, zone-update or audit-log-read endpoints in this backend.

## 3. Database inventory and schema divergence

The eleven models are `Site`, `Sector`, `EdgeNode`, `Camera`, `Zone`, `ModelVersion`, `ConfigState`, `Alert`, `AlertEvent`, `User` and `AuditLog`. Site/sector/node/camera relations cascade deletion. Alerts reference cameras; events, acknowledgement user IDs and audit entity references are not relational foreign keys.

| Field family | SQLite | PostgreSQL | Current source assumption |
|---|---|---|---|
| Alert status/severity, user role, zone kind | String | Enum | Often arbitrary string |
| `Alert.items` | JSON-encoded String | `String[]` | `JSON.stringify` on write, `JSON.parse` on read |
| Zones, model metrics/thresholds, config params, event payload, audit metadata | JSON-encoded String | `Json` | String serialization/parsing |
| `AlertEvent.seq` | Int | BigInt | JavaScript number and ordinary JSON serialization |

The schema does not enforce a single active model, unique edge API-key hashes, or a persisted mapping from each ingested edge UUID to a deduplicated incident. No migrations were found. The seed restores known demo passwords/camera state and activates the old `ppe_v1_s2_yolo11s` model metadata.

## 4. Findings, ordered by operational impact

P1 means a core function or security boundary is broken and should be addressed before relying on the system. P2 means a material correctness, operability or scale problem. These are repository-review priorities, not claims of an observed production incident.

| Priority | Finding and exact evidence | Trigger, impact and correction |
|---|---|---|
| P1 | **Four event buses disconnect live delivery.** `server/src/edge/edge.module.ts:9`, `server/src/alerts/alerts.module.ts:10`, `server/src/health/health.module.ts:8`, `server/src/realtime/realtime.module.ts:6`; each bus owns an emitter at `server/src/common/event-bus.service.ts:12`. | Actual Nest DI resolved four distinct instances. Emitting through Edge's bus invoked zero listeners on Realtime's bus. New incidents, supervisor transitions and offline telemetry do not reach live WS clients. Export one bus from a shared module and import it everywhere. |
| P1 | **Deduplication loses the physical alarm's ID and retry idempotency.** `server/src/edge/edge.service.ts:92`, `:147`, `:180`; `edge/app/outbox.py:135`; `edge/app/alarm.py:77`. | A is stored, B merges into A, B is retried: A gets 3 hits while B has no row. Acknowledging A produces `clearAlarms` containing A but never B. The edge tracks B and ignores the canonical response ID, so its alarm can remain latched. Persist every ingestion UUID as a receipt/incident alias and clear associated edge IDs; make retries use that receipt. |
| P1 | **Omitting expectedVersion bypasses CAS.** `server/src/alerts/alerts.controller.ts:62`, `server/src/alerts/alerts.service.ts:138`, and no validation pipe in `server/src/main.ts:7`. | The isolated Prisma test called `transition(id, user, {action:'ack'})`; it succeeded and incremented version to 2. Prisma omits the undefined version predicate. Require and validate a positive integer before the transaction, and reject missing/null/invalid values with 400. |
| P1 | **Acknowledgement can be skipped.** `server/src/alerts/alerts.service.ts:24`; `server/src/edge/edge.service.ts:182`. | OPEN directly resolves or becomes FALSE_ALARM, and those statuses are subsequently cleared by heartbeat. The required OPEN → ACKNOWLEDGED → terminal sequence is not enforced. Restrict resolve/false_alarm to ACKNOWLEDGED and preserve acknowledgement metadata. |
| P1 | **WebSocket exposes incidents without authentication.** `server/src/realtime/realtime.gateway.ts:48`. | A connection with no cookie, token or Origin check is admitted and can receive replay/live incident payloads, including notes and snapshot paths. The test provided empty headers and received messages. Authenticate before subscribing or replaying and authorize the relevant scope. |
| P1 | **Snapshot path traversal and unchecked upload content.** `server/src/edge/edge.service.ts:54`; `server/src/edge/edge.controller.ts:27`. | The edge-controlled ID is concatenated into a filesystem path without UUID/path validation. A safe audit fixture demonstrated `../../../../...` writing outside the configured snapshot root, and accepted non-JPEG bytes. The filename has a `.jpg` suffix, so this is arbitrary content at attacker-chosen `.jpg` paths within server write permissions. Validate IDs, generate storage names independently, enforce resolved-root containment, type and size limits. |
| P1 | **Edge node authorization is not scoped to cameras.** `server/src/edge/edge.service.ts:59`, `:111`, `:170`. | `edgeNode` is ignored for alert ownership and heartbeat camera updates filter only by camera ID. An isolated node successfully wrote an alert and online telemetry for another node's camera. Require camera ownership and enabled state for both paths. |
| P1 | **The PostgreSQL deployment source does not compile.** `server/Dockerfile:15`; `server/prisma/schema.postgresql.prisma:117`, `:135`; numerous service locations in the saved diagnostics. | Generating the PostgreSQL client separately and checking the unchanged source yields 17 TS errors for string/array, JSON/string, bigint/number and enum incompatibilities. Even suppressing these would leave invalid Prisma writes and BigInt JSON serialization. Unify schema/application representations and test the production client in CI. |
| P1 | **Alert persistence and replay event are not atomic.** `server/src/edge/edge.service.ts:108`, `:131`, `:72`. | Injecting a failure at event insertion leaves the alert committed. Retrying the UUID returns `already_exists` and never repairs the missing event. Use a transaction for ingestion receipt, incident mutation and event insertion. Node-offline incident creation has the same split at `server/src/health/offline-detector.service.ts:52`, `:70`. |
| P1 | **Known authentication fallbacks remain active.** `server/src/auth/auth.module.ts:11`, `server/src/auth/guards/jwt-auth.guard.ts:23`, `server/src/edge/edge-auth.guard.ts:24`. | When environment secrets are omitted, authentication uses committed defaults. The edge fallback also accepts the shared key after its database key record is removed/rotated. Require configured secrets and a registered active node. JWT authorization trusts embedded role for seven days without consulting current user state (`jwt-auth.guard.ts:25`); logout does not revoke issued tokens. Values are intentionally not reproduced here. |
| P2 | **Camera read leaks stored stream URLs to viewers.** `server/src/config/config.service.ts:21`, `:36`, `server/src/config/config.controller.ts:22`. | `listCameras` returns the full camera row including `streamUrlEnc`; writes and seeding put plaintext RTSP URLs into that field. When real URLs contain credentials, all authenticated roles receive them. Select a safe read DTO; implement encryption at rest if it remains a requirement. |
| P2 | **Pagination is unusable and date filters are disconnected.** `server/src/alerts/alerts.controller.ts:37`, `server/src/alerts/alerts.service.ts:45`. | Controller parses UUID cursor as integer; service only accepts a string. Both pages in the isolated test were identical. A UUID starting `550e...` became 550. Preserve an opaque cursor; validate limits and bind `from`/`to`. |
| P2 | **Replay can overwrite new state with old state.** `server/src/realtime/realtime.gateway.ts:49`, `:60`, `:74`. | Subscriber registration precedes the awaited replay query. A deterministic test sent live seq/version 2 while replay was pending, then replay seq/version 1, producing `[2,1]`. Gate/buffer live messages while replaying to a captured high-water mark; deduplicate and enforce monotonic application on the client. This latent ordering issue matters once the separate-bus defect is fixed. |
| P2 | **Invalid model activation clears the active model.** `server/src/config/config.service.ts:135`. | All models are deactivated before the requested ID is validated. Activating a nonexistent ID threw P2025 and left zero active rows in the isolated database. Validate existence and atomically switch active state; enforce single-active semantics. Concurrent activations and config mutations also lack transactional version updates. |
| P2 | **Camera stall detection is defeated by heartbeat semantics.** `server/src/edge/edge.service.ts:173`; `edge/app/heartbeat.py:64`. | The edge sends static `online`/`frameAgeMs:33`, not `lastFrameAt`. The server replaces absent frame time with receive time every heartbeat. A responding worker can mask stale video. Send actual capture timestamps/status and compare those. The camera-stall job emits telemetry only, unlike the documented warning-incident behavior. |
| P2 | **Retention contract is unimplemented.** `server/src/retention/retention.service.ts:15`. | Only old AlertEvents are deleted. Snapshot files and AuditLog rows are never purged, contrary to the 30/90-day documentation. All terminal alert IDs also remain in every heartbeat response (`edge.service.ts:180`), so storage and heartbeat payloads grow indefinitely. Implement separate retention policies and a durable bounded clear-command acknowledgement mechanism. |
| P2 | **CSV escaping and report contracts are incomplete.** `server/src/reports/reports.service.ts:53`, `:55`, `:58`, `:77`. | Only notes escape internal double quotes; camera/sector/item strings can corrupt CSV. Spreadsheet formula prefixes are not neutralized. The implementation returns totalAlerts/openIncidents, not total/open/acknowledged/resolved/false alarms expected by the E2E log and documentation. The CSV is fully materialized, not streamed. Use one encoder, an agreed aggregate DTO and bounded/streamed export. |
| P2 | **Acknowledgement attribution is overwritten on resolution.** `server/src/alerts/alerts.service.ts:144`. | Every transition rewrites ackById/ackAt. When B resolves A's acknowledgement, reports attribute acknowledgement to B at resolve time. Set acknowledgement fields only on ack; separately record resolution actor/time. |

Other grounded gaps: alert ingestion ignores incoming `model_version` and never sets `Alert.modelVersion`; config threshold validation only rejects `fire > 0.85` and accepts negative/out-of-range/incorrectly typed other values; voter parameters and polygon geometry are unvalidated; malformed bodies can produce 500s; there is no upload-size configuration, login rate limiter or graceful-shutdown registration. A changed active model is only a metadata name in the backend response, not a deployed model artifact. Concurrency during two independent ingestions can bypass secondary dedup because its read/update sequence is not atomic; this race was source-reviewed, not load-tested.

The raw event payload is also an integration mismatch: the isolated source emitted uppercase `OPEN`, string `items`, and `firstSeenAt`, with no `ts` or `sector`. The web agent's analysis covers the resulting UI behavior. Server REST list/detail parse items, but the event/replay payload does not use that DTO.

## 5. Verification performed

| Check | Result | Boundaries |
|---|---|---|
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` in `server/` | Exit 0 | Development SQLite client; proves type-check only |
| `node audit/server-review-checks.cjs` | Exit 0; 12 recorded reproductions | Direct controllers/services plus real Prisma against a fresh disposable SQLite DB; source imports use ts-node; no HTTP server or application DB |
| `node audit/server-module-wiring-check.cjs` | Exit 0; 4 buses, 0 cross-module deliveries | Real Nest application context against isolated fixture, immediately closed; no listening port |
| `node audit/server-postgres-review.cjs` | Client generation exit 0; TypeScript exit 2; 17 errors | Separate client output and path-mapped TypeScript config; no PostgreSQL connection; original generated SQLite client unchanged |
| Existing E2E script inspection | Insufficient coverage/assertions | Script was not run against live data |

Results are saved in `audit/server-review-results.json`, `audit/server-module-wiring-results.json` and `audit/server-postgres-review-results.txt`. The isolated reproduction scripts are retained. The first PostgreSQL generation attempt tried automatic dependency installation because its schema was outside the server directory and failed; the corrected check directly invoked the already-installed generator with auto-install disabled. No new dependency installation was required.

The existing E2E script labels WS replay as passed on connection/timeout without asserting received event content (`server/test_e2e.js:74–91`); it does not assert live delivery. It checks canonical UUID retransmission but not a retried deduplicated UUID. It checks a wrong CAS version but not an omitted version, concurrency or the required transition ordering. Report tests only print CSV/aggregate values (`:221–232`), including field names the API does not provide. The physical-alarm check only tests that a server response contains one ID; it does not prove hardware behavior or deduplicated-ID clearing. The script mutates seeded application records and has no fixture cleanup.

## 6. Required regression coverage

1. Real Nest-module event delivery from ingestion, transition, offline and recovery through an authenticated gateway.
2. Every valid/invalid state transition; absent, null, malformed and stale versions; concurrent supervisors; stable acknowledgement attribution.
3. Ingestion retry, deduplicated retry, out-of-order offline backlog, concurrent ingestion, event-insert failure and snapshot failure.
4. Complete edge-ID to incident mapping and clearing every active alarm only after the permitted acknowledgement sequence.
5. Unauthenticated/expired/revoked access, viewer restrictions, edge camera ownership, key revocation, snapshot traversal/type/size rejection and safe camera DTOs.
6. Cursor/date filtering, WS replay while events arrive, missing retention history and resync behavior.
7. Atomic config/model changes, nonexistent activation, single active model, invalid voter/threshold/zone input and real edge reload contracts.
8. Actual capture-age health checks; node/camera offline and recovery; uninitialized nodes and cameras.
9. PostgreSQL build plus migrations, seed/init, HTTP/WS serialization and Docker startup.
10. CSV quoting/formula handling, aggregate DTOs, snapshots/audit/event retention and bounded heartbeat clears.

No hardware timing, production PostgreSQL instance, real multi-camera feed, load behavior, or live end-to-end system was exercised. The root review separately found that the documented ports were not listening. Existing statements of 9/9 tests or running services in `brain.md` therefore are historical claims, not verification for this review.

## 7. Scratch and process handoff

All review subprocesses finished. The Nest application context was closed; no daemon/server was launched. Tool sessions 79484 and 20385 completed.

`C:\hackthon-2\audit\.server-review-scratch` held only this review's disposable databases, generated PostgreSQL client/schema/config and path-traversal fixture. The primary review removed it after resolving the exact directory, verifying containment under `C:\hackthon-2\audit`, and checking it was not a reparse point. The three small scripts, three result files and this report remain; run the isolated database probe before the module-wiring probe when reproducing. Application sources and application databases were unchanged. The primary review separately updated `brain.md` with the consolidated findings.
