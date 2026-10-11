"""
Factory Safety AI - Video Forensics Server v2 (Streaming)
Streams NDJSON events over HTTP as frames are analyzed.
Endpoint: POST /forensics/stream  -> text/event-stream (SSE)
Port: 8090
"""

import cv2, time, uuid, logging, tempfile, os, sys, base64, json, asyncio, hmac
from pathlib import Path
from typing import List, AsyncGenerator, Any, Dict, Optional, Tuple
from collections import defaultdict

import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from starlette.concurrency import iterate_in_threadpool

sys.path.insert(0, str(Path(__file__).parent.parent))
from app.config import ThresholdsConfig
from app.infer import get_inference_engine
from app.postprocess import filter_and_validate_detections
from app.association import associate_person_ppe_v2, WorkerPPEAssessment
from app.tracker import MultiPersonTracker, WorkerTrack

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("forensics")

MODEL_PATH   = os.environ.get("MODEL_PATH", str(Path(__file__).resolve().parents[2] / "models" / "best_s5.onnx"))
SAMPLE_EVERY = 5          # analyze 1 frame every 5 frames (matches test suite contract)
MAX_FRAMES   = 800        # cap per video
MAX_SNAPS    = 6          # key evidence snapshots kept
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

def generate_ai_safety_response(event_type: str, details: Dict[str, Any]) -> Dict[str, Any]:
    """Generates deterministic, actionable AI Safety Copilot guidance for detected hazards & PPE breaches."""
    ts = details.get("ts", 0.0)
    track_id = details.get("track_id")
    conf = float(details.get("confidence", 0.85))

    if event_type == "fire":
        return {
            "id": f"ai-fire-{ts}",
            "type": "FIRE_HAZARD",
            "severity": "CRITICAL",
            "title": "ACTIVE FIRE DETECTED",
            "summary": f"Thermal combustion event detected with {conf:.0%} model confidence at {ts:.1f}s.",
            "protocol": "OSHA 1910.38 / ISO 45001 Emergency Action Protocol",
            "action_items": [
                "Local edge alarm triggered (sub-10ms unlatched relay).",
                "Evacuate all personnel from active sector immediately.",
                "Deploy Class ABC dry chemical suppression systems.",
            ],
            "ts": ts,
        }
    elif event_type == "smoke":
        return {
            "id": f"ai-smoke-{ts}",
            "type": "SMOKE_HAZARD",
            "severity": "CRITICAL",
            "title": "SMOKE / COMBUSTION PLUME DETECTED",
            "summary": f"Dense smoke plume identified ({conf:.0%} confidence) at {ts:.1f}s.",
            "protocol": "NFPA 72 National Fire Alarm & Emergency Protocol",
            "action_items": [
                "Seal HVAC sector dampers to restrict smoke dispersal.",
                "Dispatch safety wardens equipped with SCBA respirators.",
                "Verify exhaust & thermal sensor telemetry.",
            ],
            "ts": ts,
        }
    elif event_type == "NO_HELMET_AND_VEST":
        return {
            "id": f"ai-w{track_id}-both-{ts}",
            "type": "MULTI_PPE_BREACH",
            "severity": "WARNING",
            "title": f"WORKER #{track_id:03d}: MULTIPLE PPE VIOLATIONS",
            "summary": f"Worker #{track_id:03d} detected at {ts:.1f}s without mandatory safety hardhat AND hi-vis vest.",
            "protocol": "OSHA 1926.100 (Head Protection) & ANSI/ISEA 107 (High-Vis)",
            "action_items": [
                f"Halt Worker #{track_id:03d} prior to active machinery interaction.",
                "Issue ANSI Z89.1 certified Type I Class E hardhat.",
                "Equip fluorescent Class 2 reflective safety vest.",
            ],
            "ts": ts,
        }
    elif event_type == "NO_HELMET":
        return {
            "id": f"ai-w{track_id}-helmet-{ts}",
            "type": "HELMET_BREACH",
            "severity": "WARNING",
            "title": f"WORKER #{track_id:03d}: MISSING HARDHAT",
            "summary": f"Worker #{track_id:03d} bare head detected in mandatory PPE sector at {ts:.1f}s.",
            "protocol": "OSHA 1926.100 Protective Helmets Directive",
            "action_items": [
                f"Supervisor intervention: verify Worker #{track_id:03d} dons approved safety helmet.",
                "Log non-compliance entry into shift safety ledger.",
            ],
            "ts": ts,
        }
    elif event_type == "NO_VEST":
        return {
            "id": f"ai-w{track_id}-vest-{ts}",
            "type": "VEST_BREACH",
            "severity": "WARNING",
            "title": f"WORKER #{track_id:03d}: MISSING HI-VIS VEST",
            "summary": f"Worker #{track_id:03d} lacking high-visibility torso protection at {ts:.1f}s.",
            "protocol": "ANSI/ISEA 107-2020 High-Visibility Apparel Standard",
            "action_items": [
                f"Equip Worker #{track_id:03d} with fluorescent reflective safety vest.",
                "Restrict movement around heavy equipment forklift lanes.",
            ],
            "ts": ts,
        }
    elif event_type == "NO_BOOTS":
        return {
            "id": f"ai-w{track_id}-boots-{ts}",
            "type": "FOOTWEAR_BREACH",
            "severity": "WARNING",
            "title": f"WORKER #{track_id:03d}: IMPROPER FOOTWEAR",
            "summary": f"Worker #{track_id:03d} lacking steel-toe safety boots at {ts:.1f}s.",
            "protocol": "ASTM F2413 Standard for Foot Protection",
            "action_items": [
                f"Verify Worker #{track_id:03d} has puncture-resistant steel-toe boots before entry.",
            ],
            "ts": ts,
        }
    elif event_type == "cigarette":
        return {
            "id": f"ai-cig-{ts}",
            "type": "SMOKING_BREACH",
            "severity": "WARNING",
            "title": "RESTRICTED ZONE SMOKING DETECTED",
            "summary": f"Open cigarette ember detected in industrial plant sector at {ts:.1f}s.",
            "protocol": "Combustible Dust & Vapor Hazard Directive",
            "action_items": [
                "Immediately extinguish open ember.",
                "Escort individual to designated plant smoking area.",
            ],
            "ts": ts,
        }
    return {
        "id": f"ai-general-{ts}",
        "type": "COMPLIANCE_NOTICE",
        "severity": "INFO",
        "title": "SAFETY COMPLIANCE LOG",
        "summary": f"Safety event '{event_type}' logged at {ts:.1f}s.",
        "protocol": "ISO 45001 Plant Operations",
        "action_items": ["Log event for end-of-shift supervisor audit."],
        "ts": ts,
    }

COLOR_MAP = {
    "person":    (0,   220, 0),     # Vibrant Green (BGR)
    "helmet":    (0,   240, 120),   # Bright Emerald Green
    "head":      (30,  30,  240),   # Vivid Crimson Red (Bare Head violation)
    "vest":      (0,   215, 60),    # Lime Green
    "gloves":    (50,  200, 70),    # Sea Green
    "boots":     (60,  190, 60),    # Forest Green
    "no_gloves": (30,  30,  240),   # Vivid Crimson Red (Violation)
    "no_boots":  (30,  30,  240),   # Vivid Crimson Red (Violation)
    "fire":      (0,   100, 255),   # Safety Orange-Red (Critical)
    "smoke":     (160, 130, 200),   # Smoke Gray-Violet (Critical)
    "cigarette": (0,   165, 255),   # Amber Warning
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
    "cigarette": "Cigarette detected; zone policy not evaluated",
}

def draw_scene(frame: np.ndarray, active_tracks: List[WorkerTrack], hazards: List[Any]) -> np.ndarray:
    """
    Person-centric, uncluttered visual annotation:
    - Primary bounding box for each tracked worker with status-tailored color.
    - Subtle inner boxes for detected helmet (emerald) or bare head violation (crimson).
    - Compact badge: ID #001 | HELMET OK | VEST OK.
    - Hazards (fire, smoke) prominent and distinct.
    """
    h, w = frame.shape[:2]
    out = frame.copy()

    font_scale = max(0.60, min(1.10, w / 1150.0))
    font_thick = max(2, int(round(font_scale * 2.2)))
    box_thick = max(2, int(round(w / 450.0)))
    pad_x = max(6, int(font_scale * 7))
    pad_y = max(4, int(font_scale * 5))

    # 1. Draw Hazards
    if hazards:
        crit_hazards = [h for h in hazards if h.class_name in CRITICAL_CLASSES]
        if crit_hazards:
            top_h = int(32 * font_scale) + 12
            cv2.rectangle(out, (0, 0), (w, top_h), (0, 30, 220), -1)
            crit_text = f"[!] CRITICAL HAZARD: {crit_hazards[0].class_name.upper()} DETECTED ({crit_hazards[0].confidence:.0%})"
            cv2.putText(out, crit_text, (16, top_h - 10), cv2.FONT_HERSHEY_SIMPLEX, font_scale * 0.85, (255, 255, 255), font_thick, cv2.LINE_AA)

    for hz in hazards:
        hx1, hy1, hx2, hy2 = [int(v * s) for v, s in zip(hz.bbox, [w, h, w, h])]
        hx1, hy1 = max(0, min(w - 1, hx1)), max(0, min(h - 1, hy1))
        hx2, hy2 = max(0, min(w - 1, hx2)), max(0, min(h - 1, hy2))
        color = COLOR_MAP.get(hz.class_name, (0, 100, 255))
        cv2.rectangle(out, (hx1, hy1), (hx2, hy2), color, box_thick + 2)
        lbl = f"{hz.class_name.upper()} {hz.confidence:.0%}"
        (tw, th), _ = cv2.getTextSize(lbl, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thick)
        by1 = max(0, hy1 - th - 2 * pad_y)
        by2 = hy1
        cv2.rectangle(out, (hx1, by1), (min(w - 1, hx1 + tw + 2 * pad_x), by2), color, -1)
        cv2.putText(out, lbl, (hx1 + pad_x, by2 - pad_y), cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255), font_thick, cv2.LINE_AA)

    # 2. Draw Active Tracked Workers
    for trk in active_tracks:
        px1, py1, px2, py2 = [int(v * s) for v, s in zip(trk.bbox, [w, h, w, h])]
        px1, py1 = max(0, min(w - 1, px1)), max(0, min(h - 1, py1))
        px2, py2 = max(0, min(w - 1, px2)), max(0, min(h - 1, py2))

        # Overall safety status color
        if trk.safety_status == "COMPLIANT":
            status_color = (0, 215, 60)      # Green
        elif trk.safety_status == "VIOLATION":
            status_color = (30, 30, 240)     # Red
        else:
            status_color = (0, 165, 255)     # Amber / Unknown

        cv2.rectangle(out, (px1, py1), (px2, py2), status_color, box_thick)

        # Subtle sub-box for associated helmet or bare head
        latest = trk.latest_assessment
        if latest and latest.has_helmet and latest.helmet_bbox and trk.helmet_status == "COMPLIANT":
            hx1, hy1, hx2, hy2 = [int(v * s) for v, s in zip(latest.helmet_bbox, [w, h, w, h])]
            hx1, hy1 = max(0, min(w - 1, hx1)), max(0, min(h - 1, hy1))
            hx2, hy2 = max(0, min(w - 1, hx2)), max(0, min(h - 1, hy2))
            cv2.rectangle(out, (hx1, hy1), (hx2, hy2), (0, 240, 120), max(2, box_thick - 1))
            # Helmet tag
            h_lbl = f"HELMET \u2713 {latest.helmet_confidence:.0%}" if latest.helmet_confidence > 0 else "HELMET \u2713"
            (htw, hth), _ = cv2.getTextSize(h_lbl, cv2.FONT_HERSHEY_SIMPLEX, font_scale * 0.7, 1)
            cv2.rectangle(out, (hx1, max(0, hy1 - hth - 4)), (min(w - 1, hx1 + htw + 6), hy1), (0, 240, 120), -1)
            cv2.putText(out, h_lbl, (hx1 + 3, hy1 - 3), cv2.FONT_HERSHEY_SIMPLEX, font_scale * 0.7, (0, 0, 0), 1, cv2.LINE_AA)
        elif latest and latest.has_head_detection and latest.head_bbox and trk.helmet_status == "VIOLATION":
            hx1, hy1, hx2, hy2 = [int(v * s) for v, s in zip(latest.head_bbox, [w, h, w, h])]
            hx1, hy1 = max(0, min(w - 1, hx1)), max(0, min(h - 1, hy1))
            hx2, hy2 = max(0, min(w - 1, hx2)), max(0, min(h - 1, hy2))
            cv2.rectangle(out, (hx1, hy1), (hx2, hy2), (30, 30, 240), max(2, box_thick - 1))
            h_lbl = "NO HELMET \u2715"
            (htw, hth), _ = cv2.getTextSize(h_lbl, cv2.FONT_HERSHEY_SIMPLEX, font_scale * 0.7, 1)
            cv2.rectangle(out, (hx1, max(0, hy1 - hth - 4)), (min(w - 1, hx1 + htw + 6), hy1), (30, 30, 240), -1)
            cv2.putText(out, h_lbl, (hx1 + 3, hy1 - 3), cv2.FONT_HERSHEY_SIMPLEX, font_scale * 0.7, (255, 255, 255), 1, cv2.LINE_AA)

        # Subtle sub-box for confirmed vest
        if latest and latest.has_vest and latest.vest_bbox and trk.vest_status == "COMPLIANT":
            vx1, vy1, vx2, vy2 = [int(v * s) for v, s in zip(latest.vest_bbox, [w, h, w, h])]
            vx1, vy1 = max(0, min(w - 1, vx1)), max(0, min(h - 1, vy1))
            vx2, vy2 = max(0, min(w - 1, vx2)), max(0, min(h - 1, vy2))
            cv2.rectangle(out, (vx1, vy1), (vx2, vy2), (0, 215, 60), max(2, box_thick - 1))
            v_lbl = f"VEST \u2713 {latest.vest_confidence:.0%}" if latest.vest_confidence > 0 else "VEST \u2713"
            (vtw, vth), _ = cv2.getTextSize(v_lbl, cv2.FONT_HERSHEY_SIMPLEX, font_scale * 0.7, 1)
            cv2.rectangle(out, (vx1, max(0, vy1 - vth - 4)), (min(w - 1, vx1 + vtw + 6), vy1), (0, 215, 60), -1)
            cv2.putText(out, v_lbl, (vx1 + 3, vy1 - 3), cv2.FONT_HERSHEY_SIMPLEX, font_scale * 0.7, (0, 0, 0), 1, cv2.LINE_AA)

        # Subtle sub-box for confirmed boots
        if latest and getattr(latest, "has_boots", False) and getattr(latest, "boots_bbox", None) and getattr(trk, "boots_status", "UNKNOWN") == "COMPLIANT":
            bx1, by1, bx2, by2 = [int(v * s) for v, s in zip(latest.boots_bbox, [w, h, w, h])]
            bx1, by1 = max(0, min(w - 1, bx1)), max(0, min(h - 1, by1))
            bx2, by2 = max(0, min(w - 1, bx2)), max(0, min(h - 1, by2))
            cv2.rectangle(out, (bx1, by1), (bx2, by2), (0, 200, 255), max(1, box_thick - 1))

        # Subtle sub-box for confirmed gloves
        if latest and getattr(latest, "has_gloves", False) and getattr(latest, "gloves_bbox", None) and getattr(trk, "gloves_status", "UNKNOWN") == "COMPLIANT":
            gx1, gy1, gx2, gy2 = [int(v * s) for v, s in zip(latest.gloves_bbox, [w, h, w, h])]
            gx1, gy1 = max(0, min(w - 1, gx1)), max(0, min(h - 1, gy1))
            gx2, gy2 = max(0, min(w - 1, gx2)), max(0, min(h - 1, gy2))
            cv2.rectangle(out, (gx1, gy1), (gx2, gy2), (255, 180, 0), max(1, box_thick - 1))

        # Compact label badge
        h_tag = "HELMET \u2713" if trk.helmet_status == "COMPLIANT" else ("NO HELMET \u2715" if trk.helmet_status == "VIOLATION" else "HELMET ?")
        v_tag = "VEST \u2713" if trk.vest_status == "COMPLIANT" else ("VEST MISSING \u2715" if trk.vest_status == "VIOLATION" else "VEST ?")
        lbl = f"ID #{trk.track_id:03d} | {h_tag} | {v_tag}"
        b_status = getattr(trk, "boots_status", "UNKNOWN")
        if b_status == "COMPLIANT":
            lbl += " | BOOTS \u2713"
        elif b_status == "VIOLATION":
            lbl += " | NO BOOTS \u2715"
        g_status = getattr(trk, "gloves_status", "UNKNOWN")
        if g_status == "COMPLIANT":
            lbl += " | GLOVES \u2713"
        elif g_status == "VIOLATION":
            lbl += " | NO GLOVES \u2715"

        (tw, th), _ = cv2.getTextSize(lbl, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thick)
        by1 = py1 - th - 2 * pad_y
        by2 = py1
        text_y = py1 - pad_y
        if by1 < 50:
            by1 = max(52, py1)
            by2 = by1 + th + 2 * pad_y
            text_y = by1 + th + pad_y

        bx2 = min(w - 1, px1 + tw + 2 * pad_x)
        cv2.rectangle(out, (px1, by1), (bx2, by2), status_color, -1)

        brightness = status_color[0] * 0.114 + status_color[1] * 0.587 + status_color[2] * 0.299
        txt_col = (0, 0, 0) if brightness > 140 else (255, 255, 255)
        cv2.putText(out, lbl, (px1 + pad_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, font_scale, txt_col, font_thick, cv2.LINE_AA)

    return out

def to_b64(frame, quality=72):
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.b64encode(buf.tobytes()).decode()

def sse(event_type: str, data: dict) -> str:
    data["type"] = event_type
    return f"data: {json.dumps(data)}\n\n"

def stream_video(filepath: str, filename: str, video_id: str) -> AsyncGenerator[str, None]:
    """Generator: yields SSE text events while analyzing video frame by frame with tracking."""
    cap = cv2.VideoCapture(filepath)
    try:
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
        tracker = MultiPersonTracker(max_lost_frames=25, iou_threshold=0.25)

        class_counts   = defaultdict(int)
        timeline       = []
        snap_frames    = []
        snap_scores    = []
        frames_analyzed= 0
        frame_idx      = 0
        critical_cnt   = 0
        last_critical_alert_ts = {}
        all_hazard_events = []
        active_violation_keys = set()
        t_start = time.time()

        sample_step = SAMPLE_EVERY

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_step == 0:
                if frames_analyzed >= MAX_FRAMES:
                    break

                detections = engine.infer(frame)
                detections = filter_and_validate_detections(detections, frame=frame)
                frames_analyzed += 1

                # Partition detections
                persons = [d for d in detections if d.class_name == "person"]
                hazards = [d for d in detections if d.class_name in CRITICAL_CLASSES or d.class_name == "cigarette"]
                ppe_items = [d for d in detections if d.class_name not in CRITICAL_CLASSES and d.class_name != "person" and d.class_name != "cigarette"]

                # Person-to-PPE Association
                assessments = associate_person_ppe_v2(persons, ppe_items, frame=frame)

                ts = round(frame_idx / fps_src, 2)

                # Update Multi-Person Tracker
                active_tracks = tracker.update(assessments, frame_idx=frame_idx, timestamp=ts)
                all_v_tracks = tracker.get_all_tracks()

                # Record detection classes
                for det in detections:
                    class_counts[det.class_name] += 1

                has_critical  = any(h.class_name in CRITICAL_CLASSES for h in hazards)
                has_violation = any(t.safety_status == "VIOLATION" for t in active_tracks)

                if has_critical:  critical_cnt += 1

                # Only encode evidence snapshots for actual alerts/violations, not regular live frames
                snap_b64 = None
                if has_critical or has_violation:
                    priority = (has_critical * 100) + (has_violation * 50) + (len(active_tracks) * 10)
                    if len(snap_frames) < MAX_SNAPS or (snap_scores and priority > min(snap_scores)):
                        annotated = draw_scene(frame, active_tracks, hazards)
                        snap_b64 = to_b64(annotated, quality=65)
                        if len(snap_frames) < MAX_SNAPS:
                            snap_frames.append(snap_b64)
                            snap_scores.append(priority)
                        elif snap_scores and priority > min(snap_scores):
                            idx_min = snap_scores.index(min(snap_scores))
                            snap_frames[idx_min] = snap_b64
                            snap_scores[idx_min] = priority

                pct = min(99, int(frames_analyzed / max(total_frames // sample_step, 1) * 100))

                track_records = [t.to_record() for t in active_tracks]
                all_track_records = [t.to_record() for t in all_v_tracks]
                det_classes = list({d.class_name for d in detections})
                hazard_records = [{"class_name": h.class_name, "confidence": round(h.confidence, 3), "bbox": h.bbox} for h in hazards]

                stats = {
                    "unique_workers": len(all_v_tracks),
                    "active_workers": len(active_tracks),
                    "compliant_workers": sum(1 for t in active_tracks if t.safety_status == "COMPLIANT"),
                    "violation_workers": sum(1 for t in active_tracks if t.safety_status == "VIOLATION"),
                    "unknown_workers": sum(1 for t in active_tracks if t.safety_status == "UNKNOWN"),
                    "critical_hazards": critical_cnt,
                }

                timeline.append({
                    "frame": frame_idx, "ts": ts,
                    "active_workers": len(active_tracks),
                    "classes": det_classes,
                    "critical": has_critical,
                    "violation": has_violation,
                })

                # Stream live frame telemetry (ultra-fast, no heavy frame image generation)
                yield sse("frame", {
                    "video_id":      video_id,
                    "frame_idx":     frame_idx,
                    "ts":            ts,
                    "pct":           pct,
                    "frames_done":   frames_analyzed,
                    "has_critical":  has_critical,
                    "has_violation": has_violation,
                    "classes":       det_classes,
                    "detections":    [{"class_id": d.class_id, "class_name": d.class_name, "confidence": round(d.confidence, 3), "bbox": d.bbox} for d in detections],
                    "hazards":       hazard_records,
                    "active_tracks": track_records,
                    "all_tracks":    all_track_records,
                    "stats":         stats,
                    "snapshot":      snap_b64,
                })

                # Fire alert events and AI Safety Copilot responses for violations on tracks
                for trk in active_tracks:
                    if trk.safety_status == "VIOLATION":
                        alert_key = f"{trk.track_id}_violation"
                        if alert_key not in active_violation_keys:
                            active_violation_keys.add(alert_key)
                            viol_items = []
                            if trk.helmet_status == "VIOLATION":
                                viol_items.append("safety helmet")
                            if trk.vest_status == "VIOLATION":
                                viol_items.append("hi-vis vest")
                            if getattr(trk, "boots_status", "UNKNOWN") == "VIOLATION":
                                viol_items.append("safety boots")

                            if trk.helmet_status == "VIOLATION" and trk.vest_status == "VIOLATION":
                                viol_class = "NO_HELMET_AND_VEST"
                            elif trk.helmet_status == "VIOLATION":
                                viol_class = "NO_HELMET"
                            elif trk.vest_status == "VIOLATION":
                                viol_class = "NO_VEST"
                            elif getattr(trk, "boots_status", "UNKNOWN") == "VIOLATION":
                                viol_class = "NO_BOOTS"
                            else:
                                viol_class = "PPE_VIOLATION"

                            viol_desc = f"Worker #{trk.track_id:03d}: Missing {', '.join(viol_items) if viol_items else 'PPE'}"
                            ai_resp = generate_ai_safety_response(viol_class, {
                                "ts": ts,
                                "track_id": trk.track_id,
                                "confidence": trk.confidence,
                            })

                            yield sse("alert", {
                                "video_id":    video_id,
                                "track_id":    trk.track_id,
                                "class":       viol_class,
                                "severity":    "WARNING",
                                "ts":          ts,
                                "confidence":  trk.confidence,
                                "desc":        viol_desc,
                                "snapshot":    snap_b64,
                                "ai_response": ai_resp,
                            })
                            yield sse("ai_response", ai_resp)

                # Fire alerts and AI Safety responses for critical hazards (fire, smoke)
                for hz in hazards:
                    if hz.class_name in CRITICAL_CLASSES:
                        last_ts = last_critical_alert_ts.get(hz.class_name, -999.0)
                        if ts - last_ts >= 1.5:  # Debounce every 1.5s
                            last_critical_alert_ts[hz.class_name] = ts
                            ai_hazard_resp = generate_ai_safety_response(hz.class_name, {
                                "ts": ts,
                                "confidence": hz.confidence,
                            })
                            hazard_alert = {
                                "video_id":    video_id,
                                "class":       hz.class_name,
                                "severity":    "CRITICAL",
                                "ts":          ts,
                                "confidence":  round(hz.confidence, 3),
                                "desc":        f"{hz.class_name.upper()} Hazard: {VIOLATION_DESC.get(hz.class_name, hz.class_name)} ({hz.confidence:.0%})",
                                "snapshot":    snap_b64,
                                "ai_response": ai_hazard_resp,
                            }
                            all_hazard_events.append(hazard_alert)
                            yield sse("alert", hazard_alert)
                            yield sse("ai_response", ai_hazard_resp)

            frame_idx += 1

        cap.release()
        t_total = round(time.time() - t_start, 2)

        # ── Build final report ──────────────────────────────────────────────
        all_tracks = tracker.get_all_tracks()
        all_worker_events = [e.to_dict() for e in tracker.get_all_safety_events()]
        combined_events = all_worker_events + all_hazard_events
        combined_events.sort(key=lambda x: x.get("start_ts", x.get("ts", 0.0)))

        unique_cnt = len(all_tracks)
        compliant_cnt = sum(1 for t in all_tracks if t.safety_status == "COMPLIANT")
        violation_cnt = sum(1 for t in all_tracks if t.safety_status == "VIOLATION")
        unknown_cnt = sum(1 for t in all_tracks if t.safety_status == "UNKNOWN")

        decided_workers = compliant_cnt + violation_cnt
        if unique_cnt == 0:
            compliance_score = None
        elif decided_workers > 0:
            compliance_score = round((compliant_cnt / decided_workers) * 100, 1)
        else:
            compliance_score = 0.0 if critical_cnt > 0 else 100.0

        violations = []
        # 1. Critical Hazards (fire, smoke)
        if class_counts.get("fire", 0) > 0:
            violations.append({"type": "fire", "count": class_counts["fire"], "severity": "CRITICAL", "description": "Active fire hazard detected"})
        if class_counts.get("smoke", 0) > 0:
            violations.append({"type": "smoke", "count": class_counts["smoke"], "severity": "CRITICAL", "description": "Smoke / combustion hazard detected"})
        if class_counts.get("cigarette", 0) > 0:
            violations.append({"type": "cigarette", "count": class_counts["cigarette"], "severity": "WARNING", "description": "Cigarette detected; zone policy not evaluated"})

        # 2. Worker violations (anchored exclusively to tracked workers)
        if unique_cnt > 0:
            no_helmet_workers = sum(1 for t in all_tracks if t.helmet_status == "VIOLATION")
            no_vest_workers = sum(1 for t in all_tracks if t.vest_status == "VIOLATION")
            no_boots_workers = sum(1 for t in all_tracks if getattr(t, "boots_status", "UNKNOWN") == "VIOLATION")
            no_gloves_workers = sum(1 for t in all_tracks if getattr(t, "gloves_status", "UNKNOWN") == "VIOLATION")

            if no_helmet_workers > 0:
                violations.append({"type": "head", "count": no_helmet_workers, "severity": "WARNING", "description": f"{no_helmet_workers} worker(s) without safety helmet"})
            if no_vest_workers > 0:
                violations.append({"type": "no_vest", "count": no_vest_workers, "severity": "WARNING", "description": f"{no_vest_workers} worker(s) without hi-vis vest"})
            if no_boots_workers > 0:
                violations.append({"type": "no_boots", "count": no_boots_workers, "severity": "WARNING", "description": f"{no_boots_workers} worker(s) without safety boots"})
            if no_gloves_workers > 0:
                violations.append({"type": "no_gloves", "count": no_gloves_workers, "severity": "INFO", "description": f"{no_gloves_workers} worker(s) without protective gloves"})

        violations.sort(key=lambda v: (0 if v["severity"] == "CRITICAL" else (1 if v["severity"] == "WARNING" else 2), -v["count"]))

        yield sse("done", {
            "video_id":           video_id,
            "filename":           filename,
            "duration_sec":       round(duration_sec, 2),
            "total_frames":       total_frames,
            "frames_analyzed":    frames_analyzed,
            "fps":                round(fps_src, 1),
            "processing_time_sec":t_total,
            "compliance_score":   compliance_score,
            "people_detected":    unique_cnt,
            "unique_workers":     unique_cnt,
            "compliant_workers":  compliant_cnt,
            "violation_workers":  violation_cnt,
            "unknown_workers":    unknown_cnt,
            "worker_records":     [t.to_record() for t in all_tracks],
            "events":             combined_events,
            "truncated":          frame_idx < total_frames - 1,
            "model":              Path(MODEL_PATH).stem,
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
    finally:
        cap.release()

app = FastAPI(title="ARGUS AI video forensics", version="3.0.0")
_jobs = asyncio.Semaphore(2)

def authorize(key):
    expected = os.environ.get("EDGE_API_KEY", "edge-api-key-factory-plant-01")
    if not key or not hmac.compare_digest(key, expected):
        raise HTTPException(status_code=401, detail="Authenticated analysis access is required")

@app.get("/health")
def health():
    return {"status": "ok", "model": Path(MODEL_PATH).stem, "port": 8090, "detector": "onnx" if _engine else "not_loaded"}

async def save_uploads(files):
    if not files or len(files) > 5:
        raise HTTPException(status_code=400, detail="Upload between one and five videos")
    saved = []
    total = 0
    try:
        for upload in files:
            filename = upload.filename or "video.mp4"
            extension = Path(filename).suffix.lower()
            video_id = str(uuid.uuid4())
            if extension not in {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"}:
                saved.append((None, filename, video_id, "Unsupported video format"))
                continue
            with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as output:
                saved.append((output.name, filename, video_id, None))
                while chunk := await upload.read(1024 * 1024):
                    total += len(chunk)
                    if total > 100 * 1024 * 1024:
                        raise HTTPException(status_code=413, detail="Uploads may total at most 100 MB")
                    output.write(chunk)
        return saved
    except BaseException:
        for filepath, *_ in saved:
            if filepath:
                Path(filepath).unlink(missing_ok=True)
        raise
    finally:
        for upload in files:
            await upload.close()

@app.post("/forensics/stream")
async def forensics_stream(files: List[UploadFile] = File(...), x_edge_api_key: str = Header(default="")):
    authorize(x_edge_api_key)
    saved = await save_uploads(files)
    async def generate():
        try:
            async with _jobs:
                for filepath, filename, video_id, error in saved:
                    if error:
                        yield sse("error", {"video_id": video_id, "filename": filename, "msg": error})
                        continue
                    generator = stream_video(filepath, filename, video_id)
                    try:
                        async for event in iterate_in_threadpool(generator):
                            yield event
                    except Exception:
                        logger.exception("Video analysis failed")
                        yield sse("error", {"video_id": video_id, "filename": filename, "msg": "Video could not be analyzed. Check the format and model availability."})
                    finally:
                        generator.close()
                yield sse("all_done", {"msg": "All videos processed"})
        finally:
            for filepath, *_ in saved:
                if filepath:
                    Path(filepath).unlink(missing_ok=True)
    return StreamingResponse(generate(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.post("/forensics/analyze")
async def analyze(files: List[UploadFile] = File(...), x_edge_api_key: str = Header(default="")):
    authorize(x_edge_api_key)
    saved = await save_uploads(files)
    results = []
    try:
        async with _jobs:
            for filepath, filename, video_id, error in saved:
                if error:
                    results.append({"filename": filename, "status": "error", "error": error})
                    continue
                generator = stream_video(filepath, filename, video_id)
                try:
                    async for event in iterate_in_threadpool(generator):
                        value = json.loads(event.removeprefix("data:").strip())
                        if value.get("type") in {"done", "error"}:
                            results.append(value)
                finally:
                    generator.close()
    finally:
        for filepath, *_ in saved:
            if filepath:
                Path(filepath).unlink(missing_ok=True)
    return {"results": results}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8090, log_level="info")
