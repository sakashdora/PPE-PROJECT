"""
Factory Safety AI - ARGUS AI
Generates complete verification deliverables for Phase 8:
1. artifacts/verification/Test_video_annotated.mp4
2. artifacts/verification/Test_video_predictions.json
3. artifacts/verification/Test_video_events.csv
4. artifacts/verification/frames/ (annotated sample frames for difficult cases)
"""

import os
import sys
import json
import csv
import time
from pathlib import Path
import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "edge"))
from app.config import ThresholdsConfig
from app.infer import ONNXRuntimeEngine
from app.postprocess import filter_and_validate_detections
from app.association import associate_person_ppe_v2
from app.tracker import MultiPersonTracker
from app.forensics_server import draw_scene

def main():
    root = Path(__file__).resolve().parent.parent
    output_dir = root / "artifacts" / "verification"
    output_dir.mkdir(parents=True, exist_ok=True)
    frames_dir = output_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    video_path = root / "Test_video" / "19832492-hd_1920_1080_25fps (1).mp4"
    if not video_path.exists():
        raise FileNotFoundError(f"Test video not found at: {video_path}")

    model_path = root / "models" / "best_s5.onnx"
    print(f"[*] Initializing ONNX Runtime with model: {model_path}")
    engine = ONNXRuntimeEngine(str(model_path), ThresholdsConfig())

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError("Failed to open video")

    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_sec = total_frames / fps

    print(f"[*] Video loaded: {w}x{h} @ {fps:.1f}fps, {total_frames} frames ({duration_sec:.2f}s)")

    # Prepare VideoWriter
    annotated_video_path = output_dir / "Test_video_annotated.mp4"
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out_writer = cv2.VideoWriter(str(annotated_video_path), fourcc, fps, (w, h))

    tracker = MultiPersonTracker(max_lost_frames=30, iou_threshold=0.25)

    all_predictions = []
    frame_idx = 0
    t_start = time.time()

    last_active_tracks = []
    last_hazards = []

    saved_sample_indices = [0, 25, 50, 75, 100, 126, 150, 189, 220, 250]

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        ts = round(frame_idx / fps, 3)

        # Run inference every 2 frames
        if frame_idx % 2 == 0 or frame_idx == 0:
            raw_dets = engine.infer(frame)
            val_dets = filter_and_validate_detections(raw_dets)

            persons = [d for d in val_dets if d.class_name == "person"]
            hazards = [d for d in val_dets if d.class_name in ("fire", "smoke", "cigarette")]
            ppes = [d for d in val_dets if d.class_name not in ("person", "fire", "smoke", "cigarette")]

            assessments = associate_person_ppe_v2(persons, ppes)
            active_tracks = tracker.update(assessments, frame_idx=frame_idx, timestamp=ts)
            last_active_tracks = active_tracks
            last_hazards = hazards

            # Record prediction data
            frame_pred = {
                "frame_idx": frame_idx,
                "timestamp_sec": ts,
                "raw_detections": [
                    {"class_id": d.class_id, "class_name": d.class_name, "confidence": float(d.confidence), "bbox": d.bbox}
                    for d in raw_dets
                ],
                "validated_detections": [
                    {"class_id": d.class_id, "class_name": d.class_name, "confidence": float(d.confidence), "bbox": d.bbox}
                    for d in val_dets
                ],
                "active_workers": [
                    t.to_record() for t in active_tracks
                ],
            }
            all_predictions.append(frame_pred)
        else:
            active_tracks = last_active_tracks
            hazards = last_hazards

        annotated_frame = draw_scene(frame, active_tracks, hazards)

        # Top dark status strip
        cv2.rectangle(annotated_frame, (0, 0), (w, 50), (20, 24, 30), -1)
        cv2.line(annotated_frame, (0, 50), (w, 50), (60, 70, 85), 2)
        hud_text = f"ARGUS AI | FRAME {frame_idx:03d}/{total_frames} | {ts:.2f}s | ACTIVE TRACKED WORKERS: {len(active_tracks)}"
        cv2.putText(annotated_frame, hud_text, (24, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (255, 255, 255), 2, cv2.LINE_AA)

        out_writer.write(annotated_frame)

        if frame_idx in saved_sample_indices:
            sample_frame_path = frames_dir / f"frame_{frame_idx:03d}_{ts:.1f}s.jpg"
            cv2.imwrite(str(sample_frame_path), annotated_frame)

        frame_idx += 1

    cap.release()
    out_writer.release()
    t_elapsed = time.time() - t_start

    print(f"[*] Processed {frame_idx} frames in {t_elapsed:.2f}s ({frame_idx/t_elapsed:.1f} FPS)")
    print(f"[*] Annotated video saved to: {annotated_video_path}")

    # Save structured predictions JSON
    predictions_path = output_dir / "Test_video_predictions.json"
    with open(predictions_path, "w", encoding="utf-8") as f:
        json.dump({
            "metadata": {
                "source_video": str(video_path.name),
                "resolution": f"{w}x{h}",
                "fps": fps,
                "total_frames": total_frames,
                "duration_sec": duration_sec,
                "model": "YOLO11s Stage 5 (best_s5.onnx)",
                "classes": 11,
                "processing_time_sec": round(t_elapsed, 2),
                "average_fps": round(frame_idx / t_elapsed, 2),
                "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            },
            "summary": {
                "total_unique_workers": len(tracker.get_all_tracks()),
                "verified_tracks": [t.to_record() for t in tracker.get_all_tracks()],
            },
            "frames": all_predictions,
        }, f, indent=2)
    print(f"[*] Predictions saved to: {predictions_path}")

    # Generate CSV Events
    events_path = output_dir / "Test_video_events.csv"
    safety_events = tracker.get_all_safety_events()
    with open(events_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "event_id", "track_id", "event_type", "severity",
            "start_time_sec", "end_time_sec", "duration_sec",
            "start_frame", "end_frame", "description", "confidence", "status"
        ])
        for ev in safety_events:
            writer.writerow([
                ev.event_id, ev.track_id, ev.event_type, ev.severity,
                ev.start_ts, ev.end_ts, round(ev.end_ts - ev.start_ts, 2),
                ev.start_frame, ev.end_frame, ev.description, ev.confidence, ev.status
            ])
    print(f"[*] Events CSV saved to: {events_path} (Rows: {len(safety_events)})")

if __name__ == "__main__":
    main()
