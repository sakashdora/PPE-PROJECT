# Infrastructure and execution evidence — 2026-10-09

Scope: repository packaging, local service availability, dependency manifests, documentation, and deployment configuration. This is a review; application code, databases, services, credentials, and model files were not changed by this work.

## Observed environment

| Item | Observation |
|---|---|
| Repository revision | `b3812db` |
| Initial working tree | `brain.md` modified; `PROJECT_ANALYSIS.md` untracked; both preserved |
| Tracked files | 152 before audit artifacts |
| Node / npm | 24.15.0 / 11.12.1 |
| Installed web packages | Next.js 15.5.25; React 19.3.0 |
| Installed backend packages | NestJS core 11.2.5; Prisma client 6.19.3; TypeScript 5.9.3 |
| Docker | No `docker` executable resolved in this session; container build/run not performed |
| CI | No tracked CI workflow found |
| Lockfiles | Root, server, and web npm lockfiles are present |

Versions above come from installed package manifests, not the package.json minimum ranges. They describe this checkout, not a proposed upgrade.

## Local service probes

Read-only HTTP requests to the following addresses were initially blocked by the sandbox. The same requests were rerun with explicit tool escalation and all failed with connection refused:

- `http://127.0.0.1:3000/`
- `http://127.0.0.1:4000/health/live`
- `http://127.0.0.1:4000/health/ready`
- `http://127.0.0.1:8080/`
- `http://127.0.0.1:8090/health`

No claim is made about other machines or earlier sessions. The historical “Running” entries in brain.md do not describe these observations. The services were not started just to make this review pass.

## Deployment findings

### I-01 — P1: server image launches a nonexistent compiled entry point

- Evidence: `server/Dockerfile:36` runs `node dist/src/main.js`; `server/tsconfig.json:13` specifies `rootDir: ./src`.
- Reproduction: invoked the installed TypeScript compiler API with the current tsconfig and an in-memory `writeFile` callback. It emitted `C:/hackthon-2/server/dist/main.js`, with zero compiler errors, zero files written to disk, and `emitSkipped: false`.
- Impact: even after resolving other build issues, this image's command cannot start the compiled server.
- Fix direction: align the image command with `dist/main.js`; verify the built image starts and passes readiness.

### I-02 — P1: the Compose edge configuration does not reach the worker

- Evidence: `infra/docker-compose.yml:76-84` supplies `SERVER_URL`, `MODEL_PATH`, `MJPEG_PORT`, and mounts data at `/app/...`; `edge/Dockerfile:4` uses `/edge`; `edge/app/config.py:100-110` only reads JSON/defaults, not these environment variables.
- The image copies only `app/` and requirements, so it does not supply the `edge_config.json` named in its command. The effective default is `models/best_s5.onnx`, relative to `/edge`, while the model volume is at `/app/models`.
- `edge/requirements.txt` omits ONNX Runtime and OpenVINO. Missing inference dependencies lead to the mock-engine fallback in `edge/app/infer.py`.
- The default outbox is `/edge/outbox.db`, outside the `/app/outbox.db` mount. Default snapshots are likewise relative to `/edge`.
- Impact: the documented deployment can run simulated detection and store recovery data outside the intended persistent volumes.
- Fix direction: choose one explicit configuration mechanism; install the selected inference runtime; validate model/config paths on startup; persist the actual outbox/snapshot locations; make simulation an explicit mode.

### I-03 — P1: PostgreSQL deployment is not equivalent to SQLite development

- `server/Dockerfile:15` generates the PostgreSQL client, whereas development uses the SQLite schema. Their scalar/JSON/list/sequence types differ.
- The backend audit generated an isolated PostgreSQL client successfully; checking the unchanged service source against it produced 17 TypeScript errors. See the backend review and saved diagnostics for the string/JSON/list/BigInt/enum incompatibilities.
- Compose starts an empty PostgreSQL database and the server but has no migration/schema-init/seed command or migration job. No tracked migration directory was found.
- Fix direction: make the database representations consistent at the service boundary, validate both providers, and add a deliberate schema deployment/initialization process. Do not treat `prisma generate` as database initialization.

### I-04 — P1: browser and container network addresses are conflated

- `web/app/api/edge/alerts/route.ts:12` and the other Next API proxies use `NEXT_PUBLIC_API_URL` for server-side requests.
- Compose sets that URL to `http://localhost:4000` (`infra/docker-compose.yml:61`). Inside the web container, localhost addresses the web container, not the NestJS service.
- Browser-facing localhost URLs also address the supervisor's computer when the browser runs on another LAN machine. Several stream/forensics paths are hard-coded to localhost.
- Fix direction: separate internal service URLs (such as the Compose service name) from browser-reachable LAN URLs; configure public URLs during the web build and validate from a second LAN workstation.

### I-05 — P2: forensics is outside the supplied deployment

- Compose contains postgres/server/web/edge only. There is no service for port 8090.
- The edge requirements omit FastAPI, Uvicorn, and the multipart upload dependency used by `edge/app/forensics_server.py`.
- Impact: deploying the documented stack does not deploy the video-forensics feature.
- Fix direction: explicitly package and supervise forensics with its dependencies, resource limits, authentication, and writable temporary storage.

### I-06 — P2: configuration examples and packaging need reconciliation

- `infra/.env.example` and Compose set `FRONTEND_URL`; the server reads `CORS_ORIGIN` (`server/src/main.ts:16`). A non-local frontend origin therefore is not configured by the documented variable.
- Compose and the example name `best.onnx`; the edge default names `best_s5.onnx`; forensics uses Stage 4. This is release drift even before considering that the Compose edge environment is ignored.
- There is no `.dockerignore` in the web build context. `COPY . .` includes local environment files and host build/dependency directories in the build context. Review this before producing distributable images.
- Both package manifests contain `argus-ai: file:..`, while their image build contexts contain only the respective subproject. The parent link is unnecessary to the observed app imports and should be reconciled with packaging; no container install failure was asserted without a build.
- README says Node 18+, but the installed NestJS core manifest requires Node >=20.
- Root `npm run dev` starts only server and web and uses `npx concurrently`; it does not start edge or forensics, and concurrently is not a declared root dependency.
- README declares MIT; server package metadata says UNLICENSED; no tracked LICENSE file was found. This is a documentation discrepancy, not a legal conclusion.

## Model artifact inventory

Artifact existence and hashes prove file identity, not accuracy or runtime selection.

| File | Bytes | SHA-256 |
|---|---:|---|
| `models/best.onnx` | 19,026,002 | `57b64e928ac3a3b42b1a086633eee41ba3325aeb367f8424929fce97ff333a13` |
| `models/best_s2.onnx` | 19,026,002 | `c22f659989e5bd98435c57d6811efe3971666ee720f5bc6c2c5159f4acba03f2` |
| `models/best_s3.onnx` | 19,055,191 | `7287f140b699ce4eeea672ce6de5880ae1b99b7c53443725c7fbccad3966483f` |
| `models/best_s4.onnx` | 19,055,189 | `82c30cfa5130a3ff4ec39c1c1907ae268c8db3f739033176ca52cd2ed58f0870` |
| `models/best_s5.onnx` | 19,054,894 | `10ed6ed176578ef10d4c8e544cec984ecbaa0d0572c88559511ecf7e2fe7a5f1` |

## Test-suite interpretation

`server/test_e2e.js` is a useful smoke-test starting point, but it mutates alerts/heartbeats in the configured development database and was not run against that database here. Its historical 9/9 result is not a result of this review.

- The WebSocket test can resolve after a timeout and prints PASS without asserting event content, continuity, authentication, or replay completeness.
- The report test prints CSV/aggregate data without asserting expected HTTP status, schema, or values.
- The alarm-clear test checks an ID in a heartbeat response; it does not exercise GPIO or the Python controller.
- No browser interaction is included; this suite cannot prove login, dashboard rendering, CAS action buttons, or audio behavior.

Review probes elsewhere use isolated data or in-memory fakes and name those limits explicitly. The next full-system verification should use a disposable environment and exercise the actual supervisor UI through the local alarm-clear handshake.
