# Edge and ML review — 2026-10-09

This is a review of the files and local artifacts in `C:\hackthon-2`, not a certification of a running safety system. `brain.md`, `AGENTS.md`, and the reliable-software review guidance were read first. No application code, credentials, configurations, models, training data, or persistent application databases were changed. No services, training jobs, physical alarms, or network synchronization were started.

## Executive assessment

The repository has a substantial edge pipeline, five actual ONNX models, a populated training/validation dataset, and seven passing edge unit tests. However, the shipped pipeline does not establish the advertised physical-alarm, camera-health, model-accuracy, or deployment guarantees. The most urgent defects are persistence before alarm activation, a default alarm adapter that only logs, automatic fabricated detections when model loading fails, inaccurate camera-health telemetry, incomplete alarm lifecycle handling, and generated acceptance metrics presented as measurements.

Existing documentation describes historical deployments and training runs. Several claims disagree with the current files. Those discrepancies are listed explicitly below rather than assuming either that the historical work never happened or that it remains deployed now.

## Components and actual execution flow

| Component | Current responsibility and boundary |
| --- | --- |
| `edge/app/config.py` | Pydantic models for camera/zone/threshold/voter settings; reads `edge_config.json` relative to current working directory and falls back to defaults. It does not read environment variables. Default model is `models/best_s5.onnx`, default endpoint is port 4000, default cameras are two synthetic sources. |
| `edge/app/stream.py` | One capture thread per camera. Synthetic frames are generated directly; real sources use OpenCV `VideoCapture` with reconnect backoff. The latest frame is copied under a lock. No frame timestamp or sequence accompanies it. |
| `edge/app/infer.py` | CPU ONNX Runtime with two intra-op threads; letterbox to 640 × 640, BGR→RGB, float32 normalization, inference, class-specific thresholding, coordinates normalized to original image. Supports embedded-NMS and raw-anchor output shapes. No OpenVINO engine is implemented. |
| `edge/app/postprocess.py` | Polygon containment, anatomical PPE association, sliding-window booleans, and per-key time cooldown. The real inference path does not produce track IDs. |
| `edge/app/main.py` | Initializes outbox, model, camera readers, heartbeat and MJPEG; processes cameras sequentially; votes on fire/smoke globally, smoking within restricted zones, and missing PPE per person/zone. |
| `edge/app/alarm.py` | In-memory critical/warning flags and active alert IDs; optional RPi.GPIO writes when constructed with a pin. The global controller is constructed without a pin, and the sound option has no implementation. |
| `edge/app/outbox.py` | SQLite `PENDING`/`DELIVERED` queue with UUID primary key. Background worker sends JSON or multipart snapshot, retries periodically, and marks any HTTP 200/201 response delivered. No cleanup, terminal/dead-letter state, exponential backoff, or canonical-ID reconciliation. |
| `edge/app/heartbeat.py` | Periodic POST to `/edge/heartbeat`, telemetry payload, clear-ID dispatch to alarm controller, optional config-version callback. The worker supplies no callback. |
| `edge/app/mjpeg.py` | JPEG frame hub; `/stream/<camera_id>`, `/snapshot/<camera_id>`, `/health`; single-threaded HTTP server. |
| `edge/app/forensics_server.py` | Separate FastAPI/SSE upload analysis on 8090; hardcodes Stage 4, samples every fifth frame, at most 600 sampled frames; emits start/frame/alert/done/all_done events. It does not use live-edge zone/PPE voting, persistence, CAS, or hardware alarms. |
| `ml/safety_pipeline.py` | Download/prepare/synthetic-degradation/train/eval/export/bench CLI. Preparation and training/export have substantive implementations. `eval` emits fixed numbers; `bench` emits random simulated latency. |
| `ml/sources.yaml` | Eight source configurations and unified 11-class mappings, including optional/missing sources; catalog entries alone do not prove the datasets were downloaded or used. |
| `ml/colab_precision95.py` | Actual Ultralytics validation threshold sweep, conditional additional training, and low-confidence embedded-NMS ONNX export. Requires Colab/GPU/data/checkpoint access; no local sweep output is retained. |
| `ml/oversample_weak_classes.py` | Train-only augmentation targeting gloves/no_gloves/no_boots; writes additional images/labels into the existing training folders. |
| `ml/colab_stage5_balanced.py` | Ten-epoch balanced-data training/export script; its presence is not evidence the run completed. |
| `ml/weights/stage4/best_s4_swa.pt` | Local 38,154,629-byte PyTorch checkpoint. It was not deserialized because running arbitrary checkpoint pickle is unnecessary for this review. |

### Live edge sequence

1. `load_config()` reads local JSON or defaults. Invalid JSON is caught and replaced by defaults, which can silently replace intended camera settings with two synthetic cameras.
2. `EdgeWorker.__init__` opens/initializes the SQLite outbox and selects an inference engine before any processing starts. An unavailable model or ONNX runtime selects `MockInferenceEngine`; missing model files do not even produce the exception warning.
3. `start()` starts the outbox worker, heartbeat, video capture threads, and MJPEG server, then enters a single inference loop.
4. `VideoStreamReader.read()` returns the last cached frame, regardless of whether capture has advanced or disconnected. The processing loop samples each camera at the configured interval, but actual throughput is bounded by sequential inference across all cameras.
5. ONNX preprocessing letterboxes to 640 × 640 with padding 114; RGB float32 `[1,3,640,640]` enters the model. Embedded-NMS rows are `[x1,y1,x2,y2,confidence,class_id]`. Stage 1/2 raw anchors are parsed without a further NMS step.
6. Fire/smoke booleans are voted at 2 positives in a window of 5. Zone detections are filtered individually by their box centers before person/PPE association. Restricted smoking uses 4/8; missing PPE uses 8/10, with absent track IDs falling back to detection index.
7. When a critical vote passes and cooldown allows a new event, `_emit_alert()` allocates UUID, creates folders, writes JPEG, and commits SQLite. Only after it returns is `trigger_critical()` called. During cooldown, the alarm is called with no event ID.
8. The background outbox sends the alert with the edge API key. It tries both `/edge/alerts` and `/api/edge/alerts` on the same configured server origin, not separate backend/frontend origins. Any HTTP 200/201 is considered success; response body is ignored.
9. The heartbeat thread sends configured camera IDs and averages. Camera status and frame age are constants, as are CPU/RAM/temperature. A successful response passes `clearAlarms` to the controller.
10. `unlatch()` removes recognized IDs and silences if the set becomes empty (or wildcard is supplied). It does not synchronize with concurrent trigger operations. Process shutdown also calls silence unconditionally; outstanding IDs are not recovered after restart.
11. The annotated image is JPEG-encoded into the frame hub. The endless stream handler monopolizes the single server request thread once a client subscribes.

### Forensics sequence

1. An unauthenticated multipart POST accepts videos by extension, reads each entire upload into memory, and writes temporary files. There is no application limit on file count, bytes, duration, resolution, or simultaneous jobs.
2. A shared lazy engine loads `models/best_s4.onnx`; failures inherit the mock fallback. `/health` does not check that loading or inference succeeds.
3. OpenCV decodes sequentially. One out of every five frames is analyzed until 600 have been analyzed; videos longer than 3,000 source frames are only partially covered. At 30 FPS this is about the first 100 seconds.
4. Each analyzed frame produces class counts/timeline and optionally annotated JPEG. Critical alerts are emitted only on the first appearance of each critical class in a video; violation detections emit per-frame events. There is no temporal confirmation, person association, required-PPE policy, or smoking-zone check.
5. The final report derives a heuristic score from explicit negative classes plus weighted fire/smoke counts divided by person-detection count. This is not a measured compliance percentage. No detections produces 100; a person without detected vest is also not penalized.
6. The response still reports original video duration/frame count and has no explicit coverage/truncation flag. The legacy batch endpoint drains events and discards the report, returning only `status: done`.
7. Temporary files are removed after each processed video. Cancellation/failure before later queued files are processed can leave their files behind; the capture handle is not protected by a `finally` block within `stream_video`.

## Prioritized findings

P1 means a safety promise, data integrity, or core deployment/workflow is broken. P2 means a significant narrower functional or operational defect. Static findings are distinguished from probes; hardware and production behavior were not exercised.

### E1 — P1: Disk persistence can prevent critical alarm activation

- **Location:** `edge/app/main.py:169–183`, `190–204`, `267–295`; SQLite connection timeout at `edge/app/outbox.py:31`.
- **Trigger:** First qualifying fire/smoke event while snapshot creation, JPEG I/O, or SQLite persistence is slow/fails.
- **Effect:** Alarm activation waits for file/database work; a propagated exception prevents activation and exits the unsupervised inference loop. The documented local under-10ms activation guarantee is not established.
- **Evidence:** Offline probe made `_emit_alert` raise `OSError("simulated disk failure")` on the second fire frame; `trigger_critical` call count was **0**. No actual disk fault or device activation occurred.
- **Fix direction:** Allocate event identity and assert the local hardware latch first, then persist asynchronously or with independent failure handling. Keep disk/logging out of the measured activation path and test blocked/full/unavailable storage.

### E2 — P1: The shipped alarm singleton does not activate hardware or sound

- **Location:** `edge/app/alarm.py:18–36`, `48–67`, `104`; no relay setting in `edge/app/config.py`.
- **Trigger:** Normal `EdgeWorker` execution using the global controller.
- **Effect:** `relay_pin=None` means GPIO initialization/output is never enabled. `enable_sound` is stored but unused. Warning alarms only print. Thus logs saying “LOCAL SIREN TRIGGERED” do not establish an audible or physical signal.
- **Evidence:** Direct source inspection; no RPi.GPIO or hardware test was attempted.
- **Fix direction:** Provide an explicitly configured, health-checked physical adapter and separate explicit demo mode. Record and test actual electrical activation latency; emit logs after the critical write.

### E3 — P1: Model/runtime failure becomes plausible fabricated detections

- **Location:** `edge/app/infer.py:176–184`; mock detections at `146–172`; forensics inherits the factory at `edge/app/forensics_server.py:38`.
- **Trigger:** Wrong working directory, missing model, missing/incompatible ONNX Runtime, corrupt model, or inference-session construction failure.
- **Effect:** A failed vision backend appears to detect workers/PPE and timed fire/smoke/cigarettes, which can enter the real outbox and alarm workflow under the configured model filename. Health/telemetry do not identify the substitute runtime.
- **Evidence:** Missing-file probe returned `MockInferenceEngine` and nine fabricated class detections on a blank image.
- **Fix direction:** Make mock mode an explicit opt-in. In production report model-unavailable health, maintain appropriate fault alarms, and prevent synthetic detections entering real incident workflows.

### E4 — P1: Camera failure remains “online” and cached evidence is re-voted

- **Location:** `edge/app/stream.py:46–51`, `112–120`; `edge/app/heartbeat.py:62–80`; worker provider at `edge/app/main.py:85–88`.
- **Trigger:** Camera disconnects/stalls after a valid frame, or never produces frames.
- **Effect:** Old frames remain available and are repeatedly processed as independent observations. Heartbeats always claim `status=online`, `frameAgeMs=33`; this defeats camera-staleness monitoring and can confirm a one-frame false positive repeatedly. CPU/RAM/temperature are also fixed demo values.
- **Evidence:** Mock POST with a camera at 0 FPS and 0 latency still sent online/33ms. Stale frame retention verified in code.
- **Fix direction:** Track capture sequence and monotonic timestamp, vote once per fresh frame, clear/age stale frames, and report measured status/telemetry.

### E5 — P1: Acknowledgement, cooldown and shutdown violate latch semantics

- **Location:** `edge/app/main.py:170–183`, `191–204`, `116–122`; `edge/app/alarm.py:69–101`.
- **Trigger:** Supervisor acknowledges an ongoing hazard before the 60s cooldown expires; another frame still meets the vote; or worker is stopped while an incident is unacknowledged.
- **Effect:** ACK silences the original ID, the next frame reactivates with **no ID**, and any later nonempty clear list can silence that untracked latch, even if its IDs are unrelated. Normal shutdown also directly silences without supervisor acknowledgement. In-memory latch/ID state is lost on restart.
- **Evidence:** Isolated controller probe reproduced `active=True, active_ids=[]` after ACK then cooldown retrigger; `unlatch(['unrelated_old_id'])` cleared it. Shutdown bypass and absent recovery are static findings.
- **Fix direction:** Define incident identity and rearm rules independently of upload cooldown; clear only matched acknowledged incidents; make shutdown/restart behavior preserve the required physical latch state. Persist/reconcile outstanding local IDs.
- **Concurrency limitation:** Trigger runs on the inference thread and unlatch on the heartbeat thread, with no mutex. A new event arriving after the empty-set test but before `silence()` can be cleared. The interleaving was reasoned from code, not stress-tested.

### E6 — P1: ML acceptance reports and benchmark commands generate results without evaluation

- **Location:** `ml/safety_pipeline.py:515–627`, especially literal values at `536–590`; simulated benchmark at `656–675`; `ml/report.json`, `ml/report/report.json`, and claims in `ml/README.md`.
- **Trigger:** Run `eval` or `bench`, even without usable weights or validation data.
- **Effect:** `eval` writes fixed 99.1% recall, 93.6% PPE precision, sample sizes, and PASSED verdicts without loading weights or data. `bench` samples random 28–36ms numbers and calls them measured host performance. Checked-in report values mirror these literals.
- **Evidence:** Entire implementations inspected; no actual evaluation or benchmark call is present. This is demonstrable source behavior, not an inference about the separate Colab runs.
- **Fix direction:** Replace placeholders with actual evaluation/measurement, fail explicitly when prerequisites are absent, and mark existing reports as illustrative until reproducible artifacts are available. Retain predictions, dataset/model hashes, split definitions and hardware/runtime details.

### E7 — P1: Container/runtime configuration cannot select the intended edge model or durable storage

- **Location:** `edge/requirements.txt:1–6`; `edge/Dockerfile:4–20`; `edge/app/config.py:52–116`; `infra/docker-compose.yml:68–84`.
- **Trigger:** Build/run the provided edge container, or launch from the documented `edge` working directory with defaults.
- **Effect:** ONNX Runtime is not installed by edge requirements. Docker uses `/edge`, while model/outbox/snapshot volumes mount under `/app`. `MODEL_PATH`, `SERVER_URL`, API key and port environment values are not read by the Pydantic `BaseModel`/JSON loader. Relative default `models/best_s5.onnx` is not `/app/models/...`; the system falls into the fabricated mock path, and local outbox/snapshots are written outside the intended mounts.
- **Evidence:** Environment override probe left model/server unchanged. Paths and dependency omissions verified in files. Docker execution was not performed.
- **Fix direction:** Unify working-directory-independent paths, explicit config/env mapping, pinned compatible runtime dependencies and volume locations; reject invalid production configuration. Validate with an offline container smoke test using the actual model.

### E8 — P1: Anatomical association credits PPE outside a worker's body

- **Location:** `edge/app/postprocess.py:107–134`.
- **Trigger:** Another person's PPE/object shares horizontal position: helmet above the worker, gloves anywhere vertically, or boots below the worker.
- **Effect:** No lower head bound, upper feet bound, or vertical glove bound exists. The same PPE may satisfy multiple people. Missing protection can be classified as compliant.
- **Evidence:** Person `[.4,.5,.6,.8]`; helmet/gloves at `[.45,.1,.55,.2]`; boots `[.45,.9,.55,1]` yielded `has_helmet/has_gloves/has_boots=True` and `missing_items=[]`.
- **Fix direction:** Enforce bounded anatomical containment/overlap and resolve competing person associations. Add crowd, vertical separation, occlusion and conflicting-positive/negative cases.

### E9 — P2: PPE votes and cooldowns belong to detection indexes, not persistent people

- **Location:** `edge/app/main.py:239–250`; ONNX detection construction at `edge/app/infer.py:95–100`, `123–128`; voter storage at `edge/app/postprocess.py:168–195`.
- **Trigger:** People disappear/re-enter, detection order changes, or another worker takes the same index.
- **Effect:** Votes persist through frames with no person and transfer to different workers. Cooldown can suppress a new person's independent violation. No real tracker generates the IDs used by the key.
- **Evidence:** Probe fed seven violating observations, **20 empty frames**, then one different person. It emitted an `8/8` violation for the new person, rather than aging the absent observations out of a ten-frame window.
- **Fix direction:** Use stable tracks with expiry or define a zone-level voter honestly; update/expire absent tracks every frame and include required-item identity where needed.

### E10 — P2: Dynamic camera/zone/threshold reload is not wired into the worker

- **Location:** `edge/app/main.py:70–75`; `edge/app/heartbeat.py:101–107`.
- **Trigger:** Server increments `configVersion` after a zone/threshold/camera edit.
- **Effect:** The heartbeat advances its local version but has no callback to fetch or apply `/edge/config`. No code in the worker invokes the advertised config endpoint. Existing zones, camera readers, thresholds and voter settings remain unchanged.
- **Evidence:** Probe received version 2 and showed `callback=None, version_after_pulse=2`; constructor wiring inspected.
- **Fix direction:** Add validated config fetching and atomic application/reconfiguration; only advance applied version after success, and test zone edits through to detection behavior.

### E11 — P2: A live MJPEG viewer blocks all other requests

- **Location:** `edge/app/mjpeg.py:41–63`, `86–89`.
- **Trigger:** First `/stream/<camera>` connection remains open.
- **Effect:** Standard `HTTPServer` processes that endless loop on its only request thread; other streams, snapshots and health requests wait. A nonexistent camera stream also loops forever without writes, preventing disconnect detection.
- **Evidence:** Static control-flow review. Web reviewer additionally confirmed `StreamTile.tsx:339` requests `/stream?cam=...`, a different route; frontend live MJPEG is gated off by an unset environment flag in the inspected configuration.
- **Fix direction:** Use a bounded concurrent streaming server, validate camera IDs, and unify/test the route contract with several simultaneous camera clients.

### E12 — P2: Forensics reports incomplete or unverified video as compliant

- **Location:** `edge/app/forensics_server.py:25–27`, `138–139`, `229–251`.
- **Trigger:** Long video, video with no detections, person-only detections, or missing vest without an explicit negative label.
- **Effect:** Only the first 600 sampled frames are covered; empty detections yield 100% and person-without-vest also avoids penalty. The output reports total source duration without an explicit coverage warning. The score is a detection-count heuristic rather than policy compliance.
- **Evidence:** Direct formula/loop inspection. FastAPI is absent in available compatible runtimes, so the attempted end-to-end generator probe could not import the module; no endpoint result is claimed.
- **Fix direction:** Report analyzed coverage and unknown/no-person status, apply explicit person/PPE/zone rules, and distinguish sampled-event density from compliance percentage. Make truncation explicit or sample across the entire video.

### E13 — P2: Forensics exposes unbounded expensive work and the batch endpoint drops results

- **Location:** `edge/app/forensics_server.py:255–293`, `325–349`; imports at `14–16`, startup at `358–360`.
- **Trigger:** Arbitrarily large/many upload files or concurrent requests; caller uses `/forensics/analyze`.
- **Effect:** Unauthenticated callers can drive memory/disk/CPU use with no application quotas; blocking decode/inference executes inside an async generator. The legacy endpoint consumes every SSE message with `pass`, so success responses omit all findings, scores and snapshots. `fastapi`, `uvicorn`, `python-multipart` are also absent from the declared edge dependencies.
- **Evidence:** Source inspection and failed `fastapi` import. Resource exhaustion was not attempted.
- **Fix direction:** Define authentication, streaming upload limits and bounded job concurrency; move blocking work off the request event loop; return the actual final report and declare/install service dependencies.

### E14 — P2: Legacy raw-anchor models have no post-inference NMS

- **Location:** `edge/app/infer.py:101–128`.
- **Trigger:** Select Stage 1/2 ONNX artifacts, whose outputs are `[1,15,8400]` with no embedded NMS.
- **Effect:** Every above-threshold anchor becomes a detection, duplicating people/PPE, increasing association and frame-processing cost, and distorting incident/report counts.
- **Evidence:** Actual model graph inspection found no `NonMaxSuppression` node in Stage 1/2. Runtime parser has no corresponding NMS call. Real inference was unavailable, so duplication rates were not measured.
- **Fix direction:** Implement tested class-aware NMS for raw outputs or restrict supported deployments to validated embedded-NMS artifacts.

### E15 — P2: Timestamp generation assumes the host is always in India time

- **Location:** `edge/app/main.py:271`.
- **Trigger:** Run on a UTC/default Linux container or any host outside UTC+05:30; timestamps near a rounded millisecond rollover.
- **Effect:** `time.strftime` uses local host time while the suffix is hardcoded `+05:30`, misdating events on other hosts. Independently sampled time components can disagree, and rounding can produce four-digit milliseconds.
- **Evidence:** Static inspection; no production event timestamps were changed.
- **Fix direction:** Take one timezone-aware datetime and serialize a true UTC/offset timestamp.

## Additional operational limits

- The outbox persists locally and retries, but “guaranteed zero data loss” is too strong: filesystem exceptions escape, JPEG write result is unchecked, delivered rows/snapshots are never pruned, pending poison records never leave the retry set, and retry response JSON is ignored. The server reviewer should correlate secondary dedup canonical IDs with local alarm IDs; this tier does not reconcile them.
- Thresholds and zones have no semantic range validation. `ZoneConfig.type`/severity are free strings; polygons with fewer than three points are treated as the whole frame. `exclusion` and `hazard` zone labels have no dedicated alert logic in the worker.
- PPE detections are filtered by zone before association. A person whose center is inside but helmet center is just outside a polygon can be falsely marked missing PPE.
- FPS calculation is reciprocal elapsed processing time, not measured capture/output rate; the timestamp baseline also includes previously processed cameras. The metric should not be treated as sustained per-camera FPS.
- Several loops have no per-camera error boundary. A single inference, annotation, persistence, or frame exception can end the edge worker loop while background heartbeat still runs until process exit.
- Alarm-controller thread safety and electrical fail-safe behavior require real target-hardware validation. None of the seven existing tests exercise alarm activation/unlatching, heartbeat/config, capture failures, model loading/parsing, MJPEG concurrency or forensics.

## ML artifacts and evidence

### Actual ONNX inspection

All five model files were read locally and their ONNX protobuf metadata and graph input/output declarations parsed without executing them. Each input is **float32** `[1,3,640,640]`; export metadata records 16-bit quantization, which is not the same as saying the external input accepts float16.

| File | Bytes | Output | NMS nodes | Export metadata version/date (UTC) |
| --- | ---: | --- | ---: | --- |
| `models/best.onnx` | 19,026,002 | float32 `[1,15,8400]` | 0 | Ultralytics 8.4.156 / 2026-09-20 |
| `models/best_s2.onnx` | 19,026,002 | float32 `[1,15,8400]` | 0 | Ultralytics 8.4.157 / 2026-09-21 |
| `models/best_s3.onnx` | 19,055,191 | float32 `[1,300,6]` | 1 | Ultralytics 8.4.162 / 2026-09-25 |
| `models/best_s4.onnx` | 19,055,189 | float32 `[1,300,6]` | 1 | Ultralytics 8.4.163 / 2026-09-26 |
| `models/best_s5.onnx` | 19,054,894 | float32 `[1,300,6]` | 1 | Ultralytics 8.4.163 / 2026-09-26 |

All embed the same 11 class names. Stage 4 metadata records opset 18; Stage 5 records opset 12. These observations establish file presence and interface shape, not predictive quality.

SHA-256 identifiers:

```text
best.onnx     57b64e928ac3a3b42b1a086633eee41ba3325aeb367f8424929fce97ff333a13
best_s2.onnx  c22f659989e5bd98435c57d6811efe3971666ee720f5bc6c2c5159f4acba03f2
best_s3.onnx  7287f140b699ce4eeea672ce6de5880ae1b99b7c53443725c7fbccad3966483f
best_s4.onnx  82c30cfa5130a3ff4ec39c1c1907ae268c8db3f739033176ca52cd2ed58f0870
best_s5.onnx  10ed6ed176578ef10d4c8e544cec984ecbaa0d0572c88559511ecf7e2fe7a5f1
```

Deployment is inconsistent: config defaults to Stage 5; forensics hardcodes Stage 4; compose names Stage 1 via an ignored environment variable; `brain.md` Section 4 still describes Stage 4 active while its later changelog records Stage 5. No OpenVINO `.xml` artifact exists under `models`, and no OpenVINO inference engine exists in `infer.py`.

### Actual local dataset counts

All local label files were scanned read-only. Every nonempty row had five fields; coordinates and semantic label correctness were not fully validated. Dataset image/label counts match by count, but a pairwise content/duplicate audit was not performed.

| Split | Images | Label files | Annotation rows |
| --- | ---: | ---: | ---: |
| train | 12,923 | 12,923 | 76,543 |
| val | 3,316 | 3,316 | 19,957 |
| val_degraded | 582 | 582 | 2,887 |

| Class | Local train | Local validation | Checked-in class_distribution.csv train |
| --- | ---: | ---: | ---: |
| person | 13,244 | 3,554 | 13,434 |
| helmet | 20,003 | 5,257 | 20,210 |
| head | 11,230 | 2,770 | 11,286 |
| vest | 10,726 | 2,877 | 10,950 |
| gloves | 3,383 | 852 | 3,409 |
| boots | 13,900 | 3,547 | 13,900 |
| no_gloves | 1,983 | 518 | 2,033 |
| no_boots | 854 | 188 | 869 |
| fire | 704 | 173 | 604 |
| smoke | 516 | 221 | 516 |
| cigarette | **0** | **0** | **0** |

This local dataset is not the historical 21,968-image/167,188-instance balanced Colab dataset described in `brain.md`. It may be an earlier/different snapshot; the review does not infer that the external balanced run failed.

Specific evidence gaps and data-quality concerns:

- `ds/data.yaml:4` sets `test: images/val`. There is no independent held-out test split in that manifest; confidence tuning and final reporting on validation are not independent evaluation.
- `ml/safety_pipeline.py:311–315` synthesizes every classification fire label as a centered 0.9 × 0.9 box, regardless of actual flame extent. Such labels are weak supervision, not validated localization annotations. The CSV's 81% average fire area is consistent with that rule.
- `ml/sources.yaml` maps SH17 “Shoes” to “boots” and “Head” to bare head. Those semantic assumptions need annotation-level validation; ordinary shoe/head labels do not inherently prove safety-boot or no-helmet status. This is a risk identified from mapping semantics, not a reannotation result.
- Cigarette has no train/val examples in the local dataset or checked-in distribution report. Smoking detection cannot be substantiated by an 11-class declaration alone.
- `ml/train_colab.ipynb` contains ten cells and **zero cells with saved outputs**. No `results.csv` exists under `ml`. Referenced Stage 3/4 training scripts from historical brain entries are absent from the current `ml` inventory.
- Stage 4 precision/recall/mAP and Stage 5 95.4% precision remain historical claims in this checkout. Separate Colab scripts contain actual validation calls, but their predictions, confusion matrices and evaluation output for the shipped hashes are not retained locally.
- `ml/thresholds.json` agrees with class thresholds in current edge defaults, but its smoking voter is 3/5 and cooldown 30s whereas runtime defaults are 4/8 and 60s. The JSON is not loaded by the edge worker.
- Stage 5's reported global 95% threshold sweep cannot establish 95% precision for runtime decisions that use lower per-class thresholds, absence-based PPE rules and temporal association; evaluate the end-to-end decision policy separately.
- Oversampling only targets train, a useful property. However, rerunning its current glob-based loop includes previously generated `_os...` labels and can recursively augment augmentations; Gaussian noise is cast to uint8 before addition, wrapping negative noise. These need reproducibility/correctness review before another training run.

## Verification performed and how to reproduce

### Existing tests

Result: **7 passed in 1.96s**, covering two association examples, cooldown expiration, temporary SQLite persistence, and three voter scenarios.

The repository `.venv\Scripts\python.exe` cannot start: its `pyvenv.cfg` points to an unavailable Windows Store Python 3.11 executable. The default `python` alias also failed. Tests were therefore run with bundled Python 3.12.14, bundled NumPy 2.3.5/Pydantic 2.13.5, then the existing venv's compatible pure-Python pytest 9.1.1/requests and OpenCV 5.0.0. No dependencies were downloaded or installed. This is a bootstrap verification environment, not proof that the declared deployment environment reproduces it.

```powershell
& 'C:\Users\cloud\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -c "import sys,os,numpy,pydantic; sys.path.append(r'C:\hackthon-2\.venv\Lib\site-packages'); sys.path.insert(0,r'C:\hackthon-2\edge'); os.environ['PYTEST_DISABLE_PLUGIN_AUTOLOAD']='1'; import pytest; raise SystemExit(pytest.main(['edge/tests','-q','-p','no:cacheprovider','--basetemp=audit/pytest-edge-20261009']))"
```

### Offline fault/contract probes

Retained script: `audit/edge_ml_review_probes_20261009.py`. It does not start services, send network requests, open application databases, load model weights, or operate hardware. Network, frame publication and alarm calls are mocked where appropriate; controller instances use no physical relay.

```powershell
& 'C:\Users\cloud\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' audit/edge_ml_review_probes_20261009.py
```

Observed outputs:

| Probe | Actual result |
| --- | --- |
| Snapshot/outbox exception before fire activation | Exception propagated; critical alarm call count 0 |
| PPE entirely above/below person | Helmet/gloves/boots all credited; no missing items |
| ACK then cooldown retrigger | Critical active with empty ID set |
| Unrelated clear list against that latch | Critical became inactive |
| Zero-FPS camera heartbeat | `online`, frame age 33ms, fixed machine telemetry |
| Config-version response | Version advanced to 2, callback remained `None` |
| Environment overrides | Model/server remained defaults |
| Missing ONNX file | Mock runtime returned plausible detections on blank input |
| Seven PPE positives, 20 absent frames, different worker | One alert with `votes='8/8'` |
| Forensics generator import | Blocked: `No module named 'fastapi'` |

### Explicit limits

- Existing native ONNX Runtime 1.30.0 could not import its `.pyd` with the available Python 3.12 runtime (`DLL load failed`). Therefore **no actual ONNX inference, accuracy evaluation, CPU latency or FPS benchmark was performed** in this review. Model protobuf interface/hash inspection is not an inference test.
- No GPU training, export, package installation, downloads, external dataset access, cloud services, live alert ingestion, GPIO, audio, RTSP device, browser playback, or Docker build was performed.
- The parent review independently checked service availability and infrastructure; consult its consolidated report for those results. Historical “running” statuses in brain are not treated as a current observation by this review.
- No physical under-10ms guarantee, end-to-end detection-to-actuation latency, hardware latch persistence, or restart recovery has been proven by existing tests.

## Recommended work order

1. Establish real hardware activation/configuration and put it before disk/logging; define ACK/rearm/restart semantics and protect alarm state across threads.
2. Fail explicitly on production model/runtime/config failure; fix container dependencies and durable paths.
3. Measure fresh camera health and fix config reload; validate live dashboard stream routing/concurrency.
4. Correct PPE association and tracking/window semantics; add meaningful integration/fault tests around the actual safety chain.
5. Replace synthetic reports/benchmarks with reproducible evaluation for the exact deployed model and policy; obtain independent test data and cigarette coverage.
6. Unify model versions and make forensics coverage, confidence and compliance limitations visible; bound and authenticate its workload.

Audit-created files retained: this report and `audit/edge_ml_review_probes_20261009.py`. The primary review removed the small disposable `audit/pytest-edge-20261009` directory after verifying its exact path and containment. Existing application code/data and user documents were preserved; the primary review separately updated `brain.md` with consolidated findings.
