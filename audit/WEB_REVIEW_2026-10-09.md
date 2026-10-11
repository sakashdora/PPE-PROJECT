# Web dashboard review — 9 October 2026

## Scope and conclusion

Reviewed the entire authored `web/` application, its Next API routes, the dashboard's server/edge contracts, and available checks. Read `brain.md`, root `AGENTS.md`, and the reliable-software review guidance before inspection. No nested web AGENTS instructions were found. This review changed no application source, configuration, databases, credentials, or running services.

The dashboard is a substantial interactive demonstration with some real integration points, but it is not yet a reliable supervisor interface for the implemented edge/server pipeline. Authentication is a navigation stub; live alerts are neither initially hydrated nor normalized to the frontend contract; administrative save operations are local demonstrations; and the camera stream URL does not match the edge server. `/forensics` is the clearest real end-to-end frontend feature: it sends video files to the Python inference service and renders streamed frame/alert/report events, although its error and file identity handling need repair.

Historical success claims in `brain.md` are not evidence that these current frontend paths work. Current source and the checks below take precedence for this review's findings.

## Route and feature inventory

| Route / module | Implemented behavior | Actual data/persistence boundary |
|---|---|---|
| `/` | Animated landing page, persona selector, boot sequence, dashboard/copilot navigation | Presentation and local state; selecting a persona grants no authenticated session |
| `/login` | Username/password inputs and demo role buttons | Submit only navigates to `/wall`; no `/auth/login` request |
| `(app)/layout.tsx` | Full-height shell, top status, bottom navigation, shared WS subscription | Connects to configured WS URL; no auth check or REST hydration |
| `/wall` live mode | Four camera tiles, layout/expand controls, critical ordering, incident sidebar, drawer | Camera definitions/FPS/latency are constants; canvas simulation is default; optional MJPEG URL is incorrect |
| `/wall` upload mode | Drop area, progress, timeline, incidents, playback-like canvas | Entirely scripted presets and timers; does not inspect/upload dropped files |
| `/alerts` | Severity tabs, search, queue/history selectors, incident drawer | Zustand store seeded with demo data, plus unnormalized WS messages |
| Shared `AlertDrawer` | CAS PATCH, error messages, notes, acknowledge/resolve/false-alarm buttons | Real PATCH attempt, but no login session normally; network errors treated as success; response version ignored; image preview is a drawing |
| `/history` | Search/severity/status controls, table, local CSV download | Volatile frontend store only; no server audit/history query; shift selector not applied |
| `/reports` | Recharts sector/trend/shift charts, KPI cards, period selector, economics | All figures are constants; changing period does not change datasets; no reports API request |
| `/health` | Hardware gauges, radar, model acceptance information | Static values and static operational/healthy labels; no live health/telemetry request |
| `/copilot` | Conversation state, prompt chips, streamed text, copy action | Posts first five store alerts plus hard-coded system health to `/api/copilot` |
| `/forensics` | Multi-file upload, streaming annotated frames, event toasts, reports/timelines/snapshots | Real multipart POST/SSE stream to hard-coded `http://localhost:8090/forensics/stream`; results live only in browser memory |
| `/settings` | Language selector, sound/reconnect/notification toggles, API URL input | Language changes shared store; other controls only change page state; no persistence or runtime/network wiring |
| `/profile` | Supervisor identity, clearance, metrics, activity cards, logout/edit buttons | Hard-coded profile; buttons do not perform authentication/profile operations |
| `/admin` | Navigation cards and synchronization claim | Static overview; no authorization or config synchronization |
| `/admin/cameras` | Camera table, add-camera modal | Local React array only; added cameras do not enter server/edge config or wall |
| `/admin/zones` | Camera links and zone counts | Static camera/zone list |
| `/admin/zones/[cameraId]` | Normalized SVG polygon drawing/deletion, zone metadata | Useful drawing interaction, but save only shows a toast; initial zones are the same demo shapes for each camera |
| `/admin/thresholds` | Confidence/voting/cooldown controls | Defaults are UI constants; save only shows a toast; no file/API/config update |
| `POST /api/edge/alerts` | JSON/multipart proxy preserving incoming API key | Forwards to NestJS; returns 503 if forwarding throws; useful real proxy |
| `GET /api/edge/alerts` | Backend liveness probe | Returns HTTP 200 even when backend is unreachable; inspect body rather than status |
| `POST /api/edge/heartbeat` | Proxy preserving incoming API key | Relays `clearAlarms`; on failure returns `ok:false, clearAlarms:[]` (safe against accidental unlatching) with HTTP 200 |
| `GET /api/edge/heartbeat` | Backend readiness probe | Returns body indicating unreachable but HTTP 200 on failure |
| `GET /api/edge/config` | Server-config proxy, ETag support, fallback config | Uses server-held edge key without authenticating caller; forces loopback server URL; fallback contains legacy model/config values |
| `POST /api/copilot` | Optional Groq streamed completion or deterministic streamed fallback | Cloud call only when key is configured; fallback ignores real context and returns authored incident/metric narratives |

## Shared component and state flow

1. `app/layout.tsx` sets metadata, theme from localStorage/OS preference, fonts/styles, and GSAP initialization.
2. Entering an operational route mounts `app/(app)/layout.tsx`. It mounts `TopStatusStrip` and `BottomDock`, and opens one WebSocket using `NEXT_PUBLIC_WS_URL` if present.
3. `features/alerts/alerts.store.ts` starts with two records from `scenarios/demo.json`, cursor `0`, and connection state `live`. There is no persistent alert cache, REST bootstrap, or explicit live/demo mode boundary.
4. `realtime/wsClient.ts` implements reconnect backoff and a 15-second watchdog for application-level pings. `alert.created`/`alert.updated` messages are cast to the frontend `Alert` interface and passed directly to store `upsert`.
5. `selectors.ts` sorts queue by severity and timestamp and expects lowercase statuses. Wall, alerts, history, top strip, navigation badges, and the copilot all reuse that store.
6. `AlertDrawer` attempts CAS PATCH with credentials, then calls a local store transition. It does not apply the authoritative returned record/version.
7. `lib/audio.ts` synthesizes browser audio; it is separate from the Python physical alarm. The top strip arms/mutes browser audio. `AudioUnlockGateModal` now returns `null` despite older documentation describing a modal.
8. `ConnectionBar`, `CriticalBanner`, `StatusFooter`, and `MockDemoEngine` remain authored modules but are not mounted/invoked by the current app flow. The old disconnected/demo notices therefore should not be assumed visible.

## Prioritized demonstrated findings

### W1 — P1: Raw backend alerts do not satisfy the frontend contract

**Locations:** [wsClient.ts:49](C:/hackthon-2/web/realtime/wsClient.ts:49), [selectors.ts:13](C:/hackthon-2/web/features/alerts/selectors.ts:13), [edge.service.ts:115](C:/hackthon-2/server/src/edge/edge.service.ts:115), [edge.service.ts:141](C:/hackthon-2/server/src/edge/edge.service.ts:141), [alerts.service.ts:183](C:/hackthon-2/server/src/alerts/alerts.service.ts:183), [types.ts:18](C:/hackthon-2/web/lib/types.ts:18).

**Trigger:** Receive a genuine server-created or updated alert. Server events contain uppercase `status`, JSON-encoded `items`, `firstSeenAt`/`lastSeenAt`, and no frontend `ts`/`sector` fields. The UI expects lowercase status, `items: string[]`, `ts`, and `sector`.

**Impact:** Real OPEN incidents are omitted from the queue and critical header because selectors require `open`. History/drawer code calling `items.join` can throw. Timestamps/location are also invalid or missing. A TypeScript cast does not convert network data.

**Evidence:** In-memory execution of the real WS client, real Zustand store, and real selectors with a server-shaped alert produced `received_raw_alert_in_queue=false` and `TypeError: ...items.join is not a function`. The server review independently confirmed raw Prisma broadcast shape in an isolated real-Prisma harness.

**Fix direction:** Define one shared transport DTO; normalize REST, live WS, and replay consistently, including parsed items, timestamp/status conventions, camera/sector enrichment, snapshot reference, and CAS version. Validate network payloads rather than asserting their type.

### W2 — P1: Fresh sessions miss all previously recorded incidents; resync cannot recover

**Locations:** [alerts.store.ts:34](C:/hackthon-2/web/features/alerts/alerts.store.ts:34), [wsClient.ts:31](C:/hackthon-2/web/realtime/wsClient.ts:31), [wsClient.ts:50](C:/hackthon-2/web/realtime/wsClient.ts:50), [alerts.store.ts:63](C:/hackthon-2/web/features/alerts/alerts.store.ts:63), [layout.tsx:23](C:/hackthon-2/web/app/(app)/layout.tsx:23), [realtime.gateway.ts:58](C:/hackthon-2/server/src/realtime/realtime.gateway.ts:58).

**Trigger:** Open or refresh the dashboard after alerts already exist. Cursor is `0`, but the truthy check omits `?since=0`; server only replays if a `since` parameter exists. No frontend `GET /alerts` or store hydration call exists. Separately, reconnect after at least 1,000 missed events to trigger server `resync`.

**Impact:** The fresh dashboard shows demo records and only future events. On resync, `setSeq(0)` is ignored by the monotonic setter, and the client neither reconnects nor reloads alerts. Event gaps remain indefinitely.

**Evidence:** In-memory probe opened exactly `ws://localhost:4000/ws`; after cursor `25` and resync it still had cursor `25` and only one socket.

**Fix direction:** Add paginated authoritative bootstrap plus a consistent snapshot/event watermark; retain a distinct cursor-reset operation and fetch a fresh snapshot on resync. Avoid replaying an unbounded history as the sole bootstrap strategy. Server review also reproduced live/replay reordering; guard frontend upsert against older alert versions and coordinate replay ordering server-side.

### W3 — P1: Dashboard login never authenticates

**Locations:** [login/page.tsx:13](C:/hackthon-2/web/app/login/page.tsx:13), [layout.tsx:15](C:/hackthon-2/web/app/(app)/layout.tsx:15), [AlertDrawer.tsx:41](C:/hackthon-2/web/features/alerts/AlertDrawer.tsx:41), [auth.controller.ts:13](C:/hackthon-2/server/src/auth/auth.controller.ts:13).

**Trigger:** Submit any nonempty login inputs or browse directly to an operational/admin route.

**Impact:** The user enters the dashboard without a backend session. Real protected CAS requests will be unauthorized unless a session was established separately. Role selectors do not represent server authorization, and profile/logout UI is not tied to the authenticated user. This is not proof that protected REST endpoints themselves can be bypassed.

**Fix direction:** Call the existing login endpoint, handle rejected credentials, load `/auth/me`, enforce applicable role visibility/route access, and wire logout. Keep demo persona selection explicitly separate from authenticated access. Existing `credentials:'include'` can carry the server's HttpOnly cookie; reading that cookie through `document.cookie` is not a valid login mechanism.

### W4 — P1: Failed CAS calls are shown as successful local acknowledgments

**Locations:** [AlertDrawer.tsx:60](C:/hackthon-2/web/features/alerts/AlertDrawer.tsx:60), [AlertDrawer.tsx:116](C:/hackthon-2/web/features/alerts/AlertDrawer.tsx:116), [alerts.store.ts:92](C:/hackthon-2/web/features/alerts/alerts.store.ts:92).

**Trigger:** Network failure during acknowledge, resolve, or false-alarm PATCH.

**Impact:** Catch returns `{ok:true,error:'offline-optimistic'}`; the drawer applies local success, displays no error, and can silence browser audio. The server has not committed the action and will not deliver physical alarm clearing for that action. The operator sees an acknowledged/resolved incident that is still open on the server.

**Fix direction:** Preserve the authoritative status until CAS succeeds, or explicitly represent a pending/unconfirmed action with durable retry and conflict handling. Never map network failure to a confirmed safety transition.

### W5 — P1: Live camera integration is disabled by current config and uses the wrong URL when enabled

**Locations:** [StreamTile.tsx:177](C:/hackthon-2/web/features/wall/StreamTile.tsx:177), [StreamTile.tsx:339](C:/hackthon-2/web/features/wall/StreamTile.tsx:339), [mjpeg.py:41](C:/hackthon-2/edge/app/mjpeg.py:41), [wall/page.tsx:27](C:/hackthon-2/web/app/(app)/wall/page.tsx:27).

**Trigger:** Open the wall with the current `.env.local`, which contains API/WS URLs but no `NEXT_PUBLIC_ENABLE_MJPEG=true`. Alternatively enable MJPEG.

**Impact:** Default always displays canvas simulation. When enabled and health succeeds, the image requests `/stream?cam=cam-01`, whereas the edge only accepts `/stream/cam-01`, producing 404. The health check runs once despite its polling comment; no retry is scheduled. All tiles continue to show `LIVE` and constant FPS/latency values.

**Fix direction:** Configure a real edge base URL, request the supported path, distinguish live/simulated/disconnected states, and add reconnect/image error behavior. Use live camera/telemetry data rather than fixed camera definitions.

### W6 — P1: Administrative saves claim edge publication without performing it

**Locations:** [thresholds/page.tsx:34](C:/hackthon-2/web/app/(app)/admin/thresholds/page.tsx:34), [thresholds/page.tsx:66](C:/hackthon-2/web/app/(app)/admin/thresholds/page.tsx:66), [zones/[cameraId]/page.tsx:113](C:/hackthon-2/web/app/(app)/admin/zones/[cameraId]/page.tsx:113), [zones/[cameraId]/page.tsx:155](C:/hackthon-2/web/app/(app)/admin/zones/[cameraId]/page.tsx:155), [cameras/page.tsx:94](C:/hackthon-2/web/app/(app)/admin/cameras/page.tsx:94).

**Trigger:** Change thresholds/voter rules/zones or add a camera and save.

**Impact:** Only React state/toast changes. Refresh loses edits; edge inference keeps previous rules; new camera never appears on the wall/server. The UI states that configuration was published or hot-reloaded when neither occurred.

**Fix direction:** Implement authenticated configuration CRUD/versioning and return persisted server state. Show edge application status separately from successful server save. Until supported, label/disable these as demonstration controls.

### W7 — P1: Health, compliance reports, and copilot narratives present authored values as operational evidence

**Locations:** [health/page.tsx:34](C:/hackthon-2/web/app/(app)/health/page.tsx:34), [health/page.tsx:77](C:/hackthon-2/web/app/(app)/health/page.tsx:77), [reports/page.tsx:34](C:/hackthon-2/web/app/(app)/reports/page.tsx:34), [reports/page.tsx:152](C:/hackthon-2/web/app/(app)/reports/page.tsx:152), [TopStatusStrip.tsx:44](C:/hackthon-2/web/components/TopStatusStrip.tsx:44), [api/copilot/route.ts:23](C:/hackthon-2/web/app/api/copilot/route.ts:23), [copilot/page.tsx:124](C:/hackthon-2/web/app/(app)/copilot/page.tsx:124).

**Trigger:** Visit these views during an outage, with an empty database, or with different actual plant activity; request a fire/shift/compliance/incident narrative.

**Impact:** Health still says operational with fixed FPS/temperature/uptime; reports still show fixed compliance/response/recall metrics; latency randomly varies between 12–16ms; copilot fallback invents an authored incident trace, containment status, supervisor, confidence and alarm latency regardless of context. Even the copilot network-failure message declares four streams nominal. Such values cannot support a safety decision or compliance record.

**Fix direction:** Bind to actual telemetry/report data with timestamps and unknown/stale states. Explicitly identify demo data. Make fallback summarize only supplied verified facts and say when evidence is unavailable. Configured Groq output is still based on a static system prompt and a small client-provided context, not independent live telemetry retrieval.

### W8 — P2: Successful CAS responses discard their authoritative version

**Locations:** [AlertDrawer.tsx:49](C:/hackthon-2/web/features/alerts/AlertDrawer.tsx:49), [AlertDrawer.tsx:120](C:/hackthon-2/web/features/alerts/AlertDrawer.tsx:120), [alerts.store.ts:92](C:/hackthon-2/web/features/alerts/alerts.store.ts:92).

**Trigger:** An authenticated PATCH succeeds while WS is disconnected, delayed, or otherwise unavailable; then resolve the acknowledged alert.

**Impact:** The PATCH response contains the incremented version, but `doTransition` ignores `result.data`. Local transition retains the old version, so the next request uses a stale `expectedVersion` and conflicts. HTTP 409 displays an error but does not refresh the record for retry.

**Evidence:** Real store execution left a version-1 record at version 1 after local acknowledgment.

**Fix direction:** Normalize and upsert the returned server record on success; refresh/reconcile on 409. Do not depend on WS delivery to finish a successful HTTP transaction.

### W9 — P2: Incident evidence preview never loads evidence

**Location:** [AlertDrawer.tsx:194](C:/hackthon-2/web/features/alerts/AlertDrawer.tsx:194).

**Trigger:** Inspect any incident with a saved server snapshot.

**Impact:** The drawer draws an icon and fixed rectangle and prints an invented `/var/lib/argus/snapshots/<id>.jpg` path. It never uses `snapshotUrl` or `GET /alerts/:id/snapshot`, while labeling the view an authenticated frame tensor. Supervisor visual verification is unavailable.

**Fix direction:** Load the authorized real snapshot endpoint, render actual bounding-box metadata, and show an honest missing/loading/error state.

### W10 — P2: Wall video upload does not process the selected video

**Locations:** [VideoUploadDetection.tsx:147](C:/hackthon-2/web/features/upload/VideoUploadDetection.tsx:147), [VideoUploadDetection.tsx:154](C:/hackthon-2/web/features/upload/VideoUploadDetection.tsx:154), [VideoUploadDetection.tsx:331](C:/hackthon-2/web/features/upload/VideoUploadDetection.tsx:331).

**Trigger:** Drop a file or click the upload area under wall upload mode.

**Impact:** File contents are ignored. Clicking does not open a file picker; timers generate progress/results from `DEMO_PRESETS`. The separate `/forensics` page has the genuine file upload/inference path.

**Fix direction:** Reuse the forensics upload implementation or explicitly label the wall experience as a prerecorded demonstration and navigate real uploads to `/forensics`.

### W11 — P2: Forensics loses per-file failures before `start` and conflates duplicate filenames

**Locations:** [forensics/page.tsx:542](C:/hackthon-2/web/app/(app)/forensics/page.tsx:542), [forensics/page.tsx:577](C:/hackthon-2/web/app/(app)/forensics/page.tsx:577), [forensics_server.py:104](C:/hackthon-2/edge/app/forensics_server.py:104), [forensics_server.py:298](C:/hackthon-2/edge/app/forensics_server.py:298).

**Trigger:** Upload a video that cannot be decoded or exceeds server validation, which emits an error without `start`; alternatively submit two files with the same name (allowed by the UI).

**Impact:** Error handler resolves only `vidMap[video_id]`, which is populated on `start`; pre-start error is dropped and the card remains queued after stream completion. `findIndex` by filename always maps both same-name videos to the first card, overwriting/mixing results and leaving another card queued. Normal stream EOF also does not mark unfinished cards failed.

**Fix direction:** Establish stable request IDs before upload and echo them in every event, including validation errors. Track duplicate files by ID rather than name. Require terminal events and handle incomplete EOF/cancellation.

### W12 — P2: Browser alarm state is not derived from current open critical alerts

**Locations:** [alerts.store.ts:54](C:/hackthon-2/web/features/alerts/alerts.store.ts:54), [audio.ts:16](C:/hackthon-2/web/lib/audio.ts:16), [audio.ts:59](C:/hackthon-2/web/lib/audio.ts:59).

**Trigger:** Receive a previously unseen already-resolved critical record during replay, receive another supervisor's acknowledgment, or receive a new critical alert while muted.

**Impact:** Any unseen critical record starts the browser siren regardless of status. Remote upsert of an acknowledgment does not reevaluate/stop the siren. `startSiren` ignores the controller's `muted` flag, so a later critical event can restart sound while the icon says muted. These defects concern browser audio, not the Python physical relay.

**Evidence:** In-memory real store probe produced `start` for a newly upserted resolved critical alert.

**Fix direction:** Recompute browser alarm demand after every authoritative store update from open critical incidents, audio permission, and mute preference. Keep physical alarm unlatching under the server/heartbeat protocol.

### W13 — P2: Config proxy crosses the edge authentication boundary

**Location:** [api/edge/config/route.ts:96](C:/hackthon-2/web/app/api/edge/config/route.ts:96).

**Trigger:** An unauthenticated client calls the Next `/api/edge/config` route.

**Impact:** The route does not validate caller credentials and supplies its own server-held edge API key upstream. It exposes configuration that the direct NestJS route protects; deployments may include camera source details. It also converts upstream non-304 errors into HTTP 200 and overwrites `server_url` with localhost regardless of configured backend.

**Fix direction:** Authenticate/authorize caller or transparently forward the caller's edge credential; preserve error status and configured network topology. Avoid silently distributing an obsolete static fallback as current authoritative config.

### W14 — P2: Browser loopback endpoints prevent ordinary remote LAN use

**Locations:** [forensics/page.tsx:51](C:/hackthon-2/web/app/(app)/forensics/page.tsx:51), [StreamTile.tsx:181](C:/hackthon-2/web/features/wall/StreamTile.tsx:181), [StreamTile.tsx:339](C:/hackthon-2/web/features/wall/StreamTile.tsx:339), [api/edge/config/route.ts:115](C:/hackthon-2/web/app/api/edge/config/route.ts:115).

**Trigger:** Open the dashboard from another supervisor workstation on the LAN.

**Impact:** Browser `localhost` resolves to that workstation, not the edge/server host. The current public API/WS environment values also assume a co-located browser. No server process on the supervisor workstation means these integrations fail.

**Fix direction:** Configure deployment-specific reachable origins or same-origin reverse proxies while keeping the required service port allocations. Compile client-visible environment values appropriately for the actual deployment.

### W15 — P2/P3: Audit and preference controls are not connected to their advertised behavior

**Locations:** [history/page.tsx:33](C:/hackthon-2/web/app/(app)/history/page.tsx:33), [history/page.tsx:35](C:/hackthon-2/web/app/(app)/history/page.tsx:35), [reports/page.tsx:93](C:/hackthon-2/web/app/(app)/reports/page.tsx:93), [settings/page.tsx:11](C:/hackthon-2/web/app/(app)/settings/page.tsx:11), [profile/page.tsx:48](C:/hackthon-2/web/app/(app)/profile/page.tsx:48).

**Trigger/impact:** History shift selection changes no filtering. Its CSV exports only the current volatile store, despite immutable audit labeling. Report period selection changes no numbers. Sound/reconnect/API URL preference changes do not affect audio/WS/API clients and are discarded on navigation. Profile logout does nothing. These are incomplete product behaviors rather than persisted administrative operations.

**Fix direction:** Use server history/report endpoints and actual period/shift queries; centralize persistent preferences; connect logout to auth. Clearly disable unsupported controls until implemented.

## Verification performed

| Check | Outcome | What it proves / does not prove |
|---|---|---|
| `web/node_modules/.bin/tsc.cmd --noEmit --incremental false` from `web` | Passed, exit 0 | Current source type-checks against installed dependencies; does not validate network payload casts or UI behavior |
| `CI=1 npm run lint` from `web` | Exit 1; Next offered ESLint setup; no existing ESLint config | No clean lint result is available; no packages/config were installed or changed |
| Source routing/dataflow inspection | Completed across all web pages, shared state/realtime/audio, upload/wall features and four Next API route modules | Supports the static findings and route matrix |
| In-memory transpilation of actual WS/store/selectors with installed TypeScript and real Zustand | Completed, exit 0 | Demonstrates omitted initial replay cursor, raw alert filtering/runtime error, failed resync reset, unchanged local CAS version, and resolved-alert siren trigger |
| Full browser/live end-to-end exercise | Not performed | Root review reported services unavailable; this web review did not start daemons, alter service state, submit real alerts, or call external Groq |
| Production Next build/container build | Not performed | Type-check is not a production packaging or deployment verification |

Exact successful probe output:

```text
initial_url=ws://localhost:4000/ws; initial_demo_count=2
received_raw_alert_in_queue=false
history_items_render=TypeError: store.getState(...).byId[raw.id].items.join is not a function
cursor_after_resync=25; socket_count=1
local_ack_version=1
resolved_alert_siren_events=["start"]
```

Probe methodology: transpiled the checked-in modules into an isolated Node VM; used installed Zustand; supplied fake WebSocket/timers and a recording audio stub; supplied a representative Prisma-shaped alert matching server source. It did not use a browser, issue a network request, write application data, or prove physical alarm timing. An initial harness-only run lacked ES module interop for JSON imports; it was corrected in the in-memory compiler options, without source edits, before the recorded successful run.

## Recommended implementation and acceptance sequence

1. Establish explicit demonstration/live modes and honest unavailable/stale states so unsupported paths do not claim operational success.
2. Connect authentication and session/role loading using the implemented server contract.
3. Define and validate one alert transport DTO across REST/live/replay; hydrate current alerts with a coordinated event cursor and robust resync.
4. Apply authoritative CAS responses and conflicts; verify two supervisors, network failures, and subsequent resolve after acknowledgment. Verify physical clear still arrives only through heartbeat.
5. Correct camera stream routing, support reachable LAN endpoints, consume telemetry, and test four simultaneous cameras plus disconnect/reconnect.
6. Load real snapshots and real history/reports; test refresh, period/shift filters, pagination, and exported data completeness.
7. Persist cameras/zones/thresholds through authenticated config APIs and verify the edge actually applies the resulting config version.
8. Unify real video upload paths and repair stable per-file identity/error handling; test unreadable media, duplicate names, multi-file jobs, and incomplete streams.
9. Derive browser audio state from current alerts and mute/permission state; test remote acknowledgment and resolved event replay.
10. Ground copilot responses in verified data, clearly label generated/demo content, and authenticate/limit any configured cloud API access. Cloud copilot availability must remain independent of the local physical alarm path.
11. Add noninteractive lint configuration and focused contract/integration coverage; then perform full browser and deployment verification. A successful TypeScript check alone is insufficient for these boundaries.
