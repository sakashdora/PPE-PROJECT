"""
Factory Safety AI - Video Forensics Server v2 (Streaming)
Streams NDJSON events over HTTP as frames are analyzed.
Endpoint: POST /forensics/stream  -> text/event-stream (SSE)
Port: 8090
"""

import cv2, time, uuid, logging, tempfile, os, sys, base64, json
from pathlib import Path
from typing import List, AsyncGenerator
from collections import defaultdict

import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

sys.path.insert(0, str(Path(__file__).parent.parent))
from app.config import ThresholdsConfig
from app.infer import get_inference_engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("forensics")

MODEL_PATH   = str(Path(__file__).parent.parent.parent / "models" / "best_s4.onnx")
SAMPLE_EVERY = 5          # analyze 1 frame every N (lower = faster live feedback)
MAX_FRAMES   = 600        # hard cap per video
MAX_SNAPS    = 8          # best annotated frames kept
FORENSICS_PORT = 8090

thresholds = ThresholdsConfig()
_engine = None

def get_engine():
    global _engine
    if _engine is None:
        logger.info(f"Loading model: {MODEL_PATH}")
        _engine = get_inference_engine(MODEL_PATH, thresholds)
    return _engine

CRITICAL_CLASSES  = {"fire", "smoke"}
VIOLATION_CLASSES = {"head", "no_gloves", "no_boots", "cigarette"}
SAFE_PPE_CLASSES  = {"helmet", "vest", "gloves", "boots"}

COLOR_MAP = {
    "person":    (0,   255, 0),
    "helmet":    (0,   220, 0),
    "head":      (30,  30,  255),
    "vest":      (0,   200, 50),
    "gloves":    (50,  200, 50),
    "boots":     (80,  180, 50),
    "no_gloves": (20,  50,  255),
    "no_boots":  (20,  80,  255),
    "fire":      (20,  100, 255),
    "smoke":     (130, 120, 200),
    "cigarette": (20,  165, 255),
}

SEVERITY_MAP = {
    "fire":      "CRITICAL",
    "smoke":     "CRITICAL",
    "head":      "WARNING",
    "no_gloves": "WARNING",
    "no_boots":  "WARNING",
    "cigarette": "WARNING",
}

VIOLATION_DESC = {
    "fire":      "Active fire hazard detected",
    "smoke":     "Smoke / combustion hazard detected",
    "head":      "Worker without helmet",
    "no_gloves": "Worker without protective gloves",
    "no_boots":  "Worker without safety boots",
    "cigarette": "Smoking in restricted zone",
}

def draw_detections(frame, detections):
    h, w = frame.shape[:2]
    out = frame.copy()
    for det in detections:
        x1, y1, x2, y2 = det.bbox
        px1,py1,px2,py2 = int(x1*w),int(y1*h),int(x2*w),int(y2*h)
        col = COLOR_MAP.get(det.class_name, (200,200,200))
        thick = 3 if det.class_name in CRITICAL_CLASSES else 2
        cv2.rectangle(out,(px1,py1),(px2,py2),col,thick)
        lbl = f"{det.class_name} {det.confidence:.0%}"
        (tw,th),_ = cv2.getTextSize(lbl,cv2.FONT_HERSHEY_SIMPLEX,0.55,1)
        cv2.rectangle(out,(px1,py1-th-8),(px1+tw+6,py1),col,-1)
        cv2.putText(out,lbl,(px1+3,py1-4),cv2.FONT_HERSHEY_SIMPLEX,0.55,(0,0,0),1,cv2.LINE_AA)
    return out

def to_b64(frame, quality=72):
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.b64encode(buf.tobytes()).decode()

def sse(event_type: str, data: dict) -> str:
    data["type"] = event_type
    return f"data: {json.dumps(data)}\n\n"

async def stream_video(filepath: str, filename: str, video_id: str) -> AsyncGenerator[str, None]:
    """Generator: yields SSE text events while analyzing video frame by frame."""
    cap = cv2.VideoCapture(filepath)
    if not cap.isOpened():
        yield sse("error", {"video_id": video_id, "filename": filename, "msg": "Cannot open video"})
        return

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps_src      = cap.get(cv2.CAP_PROP_FPS) or 25.0
    duration_sec = total_frames / fps_src if fps_src > 0 else 0.0

    yield sse("start", {
        "video_id": video_id,
        "filename": filename,
        "total_frames": total_frames,
        "fps": round(fps_src, 1),
        "duration_sec": round(duration_sec, 2),
    })

    engine = get_engine()

    class_counts   = defaultdict(int)
    timeline       = []
    snap_frames    = []
    snap_scores    = []
    frames_analyzed= 0
    frame_idx      = 0
    critical_cnt   = 0
    violation_cnt  = 0
    last_critical_class = set()
    t_start = time.time()

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % SAMPLE_EVERY == 0:
            if frames_analyzed >= MAX_FRAMES:
                break

            detections   = engine.infer(frame)
            frames_analyzed += 1

            has_critical  = any(d.class_name in CRITICAL_CLASSES  for d in detections)
            has_violation = any(d.class_name in VIOLATION_CLASSES for d in detections)

            if has_critical:  critical_cnt  += 1
            if has_violation: violation_cnt += 1

            for det in detections:
                class_counts[det.class_name] += 1

            ts = round(frame_idx / fps_src, 2)
            det_classes = list({d.class_name for d in detections})
            timeline.append({
                "frame": frame_idx, "ts": ts,
                "classes": det_classes,
                "critical": has_critical,
                "violation": has_violation,
            })

            # Build annotated frame for live preview
            priority = (has_critical * 100) + (has_violation * 50) + (len(detections) * 2)
            snap_b64 = None
            if detections:
                annotated = draw_detections(frame, detections)
                snap_b64  = to_b64(annotated)
                if len(snap_frames) < MAX_SNAPS:
                    snap_frames.append(snap_b64)
                    snap_scores.append(priority)
                elif priority > min(snap_scores):
                    idx_min = snap_scores.index(min(snap_scores))
                    snap_frames[idx_min] = snap_b64
                    snap_scores[idx_min] = priority

            pct = min(99, int(frames_analyzed / max(total_frames // SAMPLE_EVERY, 1) * 100))

            # Stream live frame event
            yield sse("frame", {
                "video_id":      video_id,
                "frame_idx":     frame_idx,
                "ts":            ts,
                "pct":           pct,
                "frames_done":   frames_analyzed,
                "has_critical":  has_critical,
                "has_violation": has_violation,
                "classes":       det_classes,
                "detections":    [{"class_name": d.class_name, "confidence": round(d.confidence, 3), "bbox": d.bbox} for d in detections],
                "snapshot":      snap_b64,   # annotated JPEG for live view (None if no dets)
            })

            # Fire alert events for new critical classes
            for det in detections:
                if det.class_name in CRITICAL_CLASSES and det.class_name not in last_critical_class:
                    last_critical_class.add(det.class_name)
                    yield sse("alert", {
                        "video_id":  video_id,
                        "class":     det.class_name,
                        "severity":  "CRITICAL",
                        "ts":        ts,
                        "confidence": round(det.confidence, 3),
                        "desc":      VIOLATION_DESC.get(det.class_name, det.class_name),
                        "snapshot":  snap_b64,
                    })
                elif det.class_name in VIOLATION_CLASSES:
                    yield sse("alert", {
                        "video_id":  video_id,
                        "class":     det.class_name,
                        "severity":  "WARNING",
                        "ts":        ts,
                        "confidence": round(det.confidence, 3),
                        "desc":      VIOLATION_DESC.get(det.class_name, det.class_name),
                        "snapshot":  snap_b64,
                    })

        frame_idx += 1

    cap.release()
    t_total = round(time.time() - t_start, 2)

    # ── Build final report ──────────────────────────────────────────────
    violations = []
    for cls, sev in SEVERITY_MAP.items():
        cnt = class_counts.get(cls, 0)
        if cnt > 0:
            violations.append({"type": cls, "count": cnt, "severity": sev, "description": VIOLATION_DESC.get(cls, cls)})
    violations.sort(key=lambda v: (0 if v["severity"] == "CRITICAL" else 1, -v["count"]))

    person_frames   = max(class_counts.get("person", 1), 1)
    viol_events     = sum(class_counts.get(c, 0) for c in VIOLATION_CLASSES)
    fire_penalty    = (class_counts.get("fire", 0) + class_counts.get("smoke", 0)) * 3
    raw_v           = viol_events + fire_penalty
    compliance_score = round(max(0.0, min(100.0, 100.0 - (raw_v / person_frames) * 100)), 1)

    yield sse("done", {
        "video_id":           video_id,
        "filename":           filename,
        "duration_sec":       round(duration_sec, 2),
        "total_frames":       total_frames,
        "frames_analyzed":    frames_analyzed,
        "fps":                round(fps_src, 1),
        "processing_time_sec":t_total,
        "compliance_score":   compliance_score,
        "critical_events":    critical_cnt,
        "ppe_violations":     violation_cnt,
        "fire_detections":    class_counts.get("fire", 0),
        "smoke_detections":   class_counts.get("smoke", 0),
        "smoking_events":     class_counts.get("cigarette", 0),
        "class_counts":       dict(class_counts),
        "violations":         violations,
        "snapshot_frames":    snap_frames,
        "timeline":           timeline,
    })

# ── FastAPI App ────────────────────────────────────────────────────────────────
app = FastAPI(title="Factory Safety AI - Video Forensics Streaming", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_PATH, "port": FORENSICS_PORT, "version": "2.0-stream"}

@app.post("/forensics/stream")
async def forensics_stream(files: List[UploadFile] = File(...)):
    """
    Upload 1+ video files. Returns an SSE (text/event-stream) response.
    Events: start | frame | alert | done | error
    Multiple videos are analyzed sequentially, all events share the stream.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    ALLOWED = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"}

    # Save all files first, then stream analysis
    saved = []
    for upload in files:
        fname = upload.filename or "video.mp4"
        ext   = Path(fname).suffix.lower()
        if ext not in ALLOWED:
            saved.append((None, fname, f"Unsupported format: {ext}"))
            continue
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = await upload.read()
            tmp.write(content)
            saved.append((tmp.name, fname, None))

    async def generate():
        for (fpath, fname, err) in saved:
            vid_id = str(uuid.uuid4())[:8]
            if err or fpath is None:
                yield sse("error", {"video_id": vid_id, "filename": fname, "msg": err or "Unknown error"})
                continue
            try:
                async for event in stream_video(fpath, fname, vid_id):
                    yield event
            except Exception as ex:
                logger.error(f"Stream error {fname}: {ex}", exc_info=True)
                yield sse("error", {"video_id": vid_id, "filename": fname, "msg": str(ex)})
            finally:
                try:
                    os.unlink(fpath)
                except Exception:
                    pass
        yield sse("all_done", {"msg": "All videos processed"})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )

# Keep legacy batch endpoint
@app.post("/forensics/analyze")
async def forensics_analyze(files: List[UploadFile] = File(...)):
    """Legacy non-streaming batch endpoint."""
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")
    ALLOWED = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"}
    results = []
    for upload in files:
        fname = upload.filename or "video.mp4"
        ext   = Path(fname).suffix.lower()
        if ext not in ALLOWED:
            results.append({"video_id": str(uuid.uuid4())[:8], "filename": fname, "status": "error", "error": f"Unsupported format: {ext}"})
            continue
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = await upload.read()
            tmp.write(content)
            tmp_path = tmp.name
        try:
            vid_id = str(uuid.uuid4())[:8]
            events = []
            async for ev in stream_video(tmp_path, fname, vid_id):
                pass   # just drain; final result captured via stream
            # Fallback: return empty
            results.append({"video_id": vid_id, "filename": fname, "status": "done"})
        except Exception as ex:
            results.append({"video_id": str(uuid.uuid4())[:8], "filename": fname, "status": "error", "error": str(ex)})
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
    return JSONResponse(content={"results": results})

if __name__ == "__main__":
    import uvicorn
    logger.info(f"[FORENSICS] Starting streaming server on :{FORENSICS_PORT}")
    uvicorn.run("app.forensics_server:app", host="0.0.0.0", port=FORENSICS_PORT, reload=False, log_level="info")
