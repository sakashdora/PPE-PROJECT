"""
End-to-End Regression Test for Uploaded Video Processing,
Worker Tracking, and PPE Compliance Classification.
Generates a realistic test video sequence featuring compliant and violating workers,
streams it through the forensics processing engine, and validates all tracking records,
safety status classifications, and event generation.
"""

import json
import pytest
import cv2
import numpy as np
from pathlib import Path

from app.forensics_server import stream_video


def test_end_to_end_video_processing(tmp_path):
    video_path = tmp_path / "test_ppe_pipeline.avi"
    fps = 10
    w, h = 640, 480
    writer = cv2.VideoWriter(str(video_path), cv2.VideoWriter_fourcc(*"MJPG"), fps, (w, h))
    assert writer.isOpened()

    # Create 25 frames
    # Read real validation images: one compliant, one violation
    img_compliant_p = Path("ds/images/val/construction_ppe_image1003.jpg")
    img_violation_p = Path("ds/images/val/construction_ppe_image1120.jpg")

    frame_compliant = cv2.resize(cv2.imread(str(img_compliant_p)), (w, h)) if img_compliant_p.exists() else np.zeros((h, w, 3), dtype=np.uint8)
    frame_violation = cv2.resize(cv2.imread(str(img_violation_p)), (w, h)) if img_violation_p.exists() else np.zeros((h, w, 3), dtype=np.uint8)

    # 12 frames of compliant scene, then 13 frames of violation scene
    for _ in range(12):
        writer.write(frame_compliant)
    for _ in range(13):
        writer.write(frame_violation)
    writer.release()

    events = []
    for sse_event in stream_video(str(video_path), "test_ppe_pipeline.avi", "test-vid-001"):
        line = sse_event.strip()
        if line.startswith("data:"):
            events.append(json.loads(line.removeprefix("data:").strip()))

    event_types = [e["type"] for e in events]
    assert "start" in event_types
    assert "frame" in event_types
    assert "done" in event_types

    done_event = next(e for e in events if e["type"] == "done")

    # Verify structural compliance
    assert done_event["video_id"] == "test-vid-001"
    assert done_event["filename"] == "test_ppe_pipeline.avi"
    assert done_event["frames_analyzed"] == 5  # 25 frames sampled every 5 = 5 frames
    assert "worker_records" in done_event
    assert "events" in done_event
    assert "unique_workers" in done_event
    assert "compliant_workers" in done_event

    # Verify tracking records
    worker_records = done_event["worker_records"]
    assert len(worker_records) >= 1

    for record in worker_records:
        assert "track_id" in record
        assert "helmet" in record
        assert "vest" in record
        assert "boots" in record
        assert "gloves" in record
        assert "safety_status" in record
        assert record["safety_status"] in ("COMPLIANT", "VIOLATION", "UNKNOWN")
        assert "first_seen" in record
        assert "last_seen" in record

    # Check frame stream event
    frame_events = [e for e in events if e["type"] == "frame"]
    assert len(frame_events) == 5
    for fe in frame_events:
        assert "active_tracks" in fe
        assert "detections" in fe
        assert "stats" in fe
        assert "unique_workers" in fe["stats"]
        assert "snapshot" in fe


def test_empty_scene_zero_person_no_phantom_violations(tmp_path):
    video_path = tmp_path / "empty_factory_room.avi"
    fps = 10
    w, h = 640, 480
    writer = cv2.VideoWriter(str(video_path), cv2.VideoWriter_fourcc(*"MJPG"), fps, (w, h))
    assert writer.isOpened()
    for _ in range(15):
        # Empty scene (black frame)
        writer.write(np.zeros((h, w, 3), dtype=np.uint8))
    writer.release()

    events = []
    for sse_event in stream_video(str(video_path), "empty_factory_room.avi", "test-vid-empty"):
        line = sse_event.strip()
        if line.startswith("data:"):
            events.append(json.loads(line.removeprefix("data:").strip()))

    done_event = next(e for e in events if e["type"] == "done")
    assert done_event["people_detected"] == 0
    assert done_event["unique_workers"] == 0
    assert done_event["compliance_score"] is None
    # Strictly zero phantom worker violations
    assert done_event["violations"] == []
