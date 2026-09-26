"""
Factory Safety AI - Edge Stream Orchestrator
Main edge daemon running inference, temporal voting, zone evaluation,
local alarm activation, and outbox synchronization across all configured camera streams.
"""

import os
import sys
import time
import json
import uuid
import signal
import logging
import argparse
from pathlib import Path
from typing import Dict, List, Optional
import cv2
import numpy as np

from app.config import EdgeConfig, load_config
from app.stream import VideoStreamReader
from app.infer import get_inference_engine, BaseInferenceEngine
from app.postprocess import (
    Detection,
    associate_person_ppe,
    point_in_polygon,
    box_center,
    TemporalVoter,
    AlertCooldown,
)
from app.alarm import alarm_controller
from app.outbox import OutboxManager
from app.mjpeg import frame_hub, start_mjpeg_server
from app.heartbeat import HeartbeatClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("edge.main")

# Bounding box color palette (BGR)
COLORS = {
    "person": (240, 200, 0),       # Cyan-yellow
    "helmet": (50, 205, 50),       # Green
    "head": (0, 0, 255),           # Bright Red (bare head = violation!)
    "vest": (0, 215, 255),         # Hi-vis Amber/Orange
    "gloves": (255, 144, 30),      # Blue
    "boots": (205, 90, 106),       # Slate
    "no_gloves": (0, 0, 220),      # Red
    "no_boots": (0, 0, 220),       # Red
    "fire": (0, 69, 255),          # Bright Fire Orange/Red
    "smoke": (128, 128, 128),      # Smoke Grey
    "cigarette": (0, 165, 255),    # Hazard Orange
}

class EdgeWorker:
    def __init__(self, config: EdgeConfig):
        self.config = config
        self.running = False

        # Subsystems
        api_key = getattr(config, "api_key", "edge-api-key-factory-plant-01")
        self.outbox = OutboxManager(config.db_path, api_key=api_key)
        self.voter = TemporalVoter()
        self.cooldown = AlertCooldown(config.cooldown_seconds)
        self.engine = get_inference_engine(config.model_path, config.thresholds)

        # Heartbeat & Telemetry Subsystem
        self.heartbeat = HeartbeatClient(
            server_url=config.server_url,
            node_id=config.node_id,
            api_key=api_key,
            interval_sec=config.heartbeat_interval_sec,
        )

        # Camera readers
        self.readers: Dict[str, VideoStreamReader] = {}
        for cam in config.cameras:
            self.readers[cam.id] = VideoStreamReader(cam.id, cam.source, cam.fps_target)

        # Configure telemetry providers
        self.fps_counters: Dict[str, float] = {cam.id: 0.0 for cam in config.cameras}
        self.latency_ms: Dict[str, float] = {cam.id: 0.0 for cam in config.cameras}
        self.heartbeat.set_telemetry_providers(
            fps_fn=lambda: self.fps_counters,
            latency_fn=lambda: self.latency_ms,
            cameras_fn=lambda: list(self.readers.keys()),
        )

        # Snapshot storage directory
        self.snapshot_dir = Path("snapshots")
        self.snapshot_dir.mkdir(parents=True, exist_ok=True)
        self.last_heartbeat = 0.0

    def start(self):
        self.running = True
        logger.info(f"[*] Starting Edge Worker Node: {self.config.node_id}")

        # 1. Start SQLite Outbox Worker
        self.outbox.start_worker(self.config.server_url, poll_interval=2.0)

        # 2. Start Heartbeat Client
        self.heartbeat.start()

        # 3. Start Video Readers
        for cam_id, reader in self.readers.items():
            reader.start()

        # 4. Start MJPEG Stream Server
        start_mjpeg_server(port=self.config.mjpeg_port)

        logger.info("[OK] All edge pipelines running. Commencing real-time inference loop.")
        self._run_loop()

    def stop(self):
        self.running = False
        self.heartbeat.stop()
        for reader in self.readers.values():
            reader.stop()
        self.outbox.stop_worker()
        alarm_controller.silence()
        logger.info("[*] Edge Worker stopped cleanly.")

    def _run_loop(self):
        frame_intervals = {cam.id: 1.0 / max(1, cam.fps_target) for cam in self.config.cameras}
        last_processed = {cam.id: 0.0 for cam in self.config.cameras}

        while self.running:
            now = time.time()
            for cam in self.config.cameras:
                if now - last_processed[cam.id] >= frame_intervals[cam.id]:
                    last_processed[cam.id] = now
                    reader = self.readers.get(cam.id)
                    if not reader:
                        continue

                    ret, frame = reader.read()
                    if not ret or frame is None:
                        continue

                    t0 = time.time()
                    self._process_camera_frame(cam, frame)
                    infer_time = (time.time() - t0) * 1000.0
                    self.latency_ms[cam.id] = round(infer_time, 1)
                    self.fps_counters[cam.id] = round(1.0 / max(0.001, (time.time() - now)), 1)


            time.sleep(0.01)

    def _process_camera_frame(self, cam, frame: np.ndarray):
        h, w = frame.shape[:2]

        # 1. Execute Inference
        detections = self.engine.infer(frame)

        # 2. Check Critical Hazards (Fire / Smoke) across whole frame
        fire_detections = [d for d in detections if d.class_name == "fire"]
        smoke_detections = [d for d in detections if d.class_name == "smoke"]

        is_fire_present = len(fire_detections) > 0
        is_smoke_present = len(smoke_detections) > 0

        # Temporal Voting for Fire (2/5)
        fire_trig, f_votes = self.voter.vote(
            f"{cam.id}_fire", is_fire_present,
            self.config.voter.fire_window, self.config.voter.fire_threshold
        )
        if fire_trig:
            alert_id = None
            if self.cooldown.should_fire(f"{cam.id}_fire_alert"):
                alert_id = self._emit_alert(
                    cam=cam,
                    zone_id=cam.zones[0].id if cam.zones else "global",
                    severity="CRITICAL",
                    alert_type="fire",
                    items=["fire"],
                    confidence=fire_detections[0].confidence if fire_detections else 0.85,
                    votes=f_votes,
                    bbox=fire_detections[0].bbox if fire_detections else [0, 0, 1, 1],
                    frame=frame
                )
            alarm_controller.trigger_critical(cam.id, "fire", f"Votes: {f_votes}", alert_id=alert_id)

        # Temporal Voting for Smoke (2/5)
        smoke_trig, s_votes = self.voter.vote(
            f"{cam.id}_smoke", is_smoke_present,
            self.config.voter.smoke_window, self.config.voter.smoke_threshold
        )
        if smoke_trig:
            alert_id = None
            if self.cooldown.should_fire(f"{cam.id}_smoke_alert"):
                alert_id = self._emit_alert(
                    cam=cam,
                    zone_id=cam.zones[0].id if cam.zones else "global",
                    severity="CRITICAL",
                    alert_type="smoke",
                    items=["smoke"],
                    confidence=smoke_detections[0].confidence if smoke_detections else 0.80,
                    votes=s_votes,
                    bbox=smoke_detections[0].bbox if smoke_detections else [0, 0, 1, 1],
                    frame=frame
                )
            alarm_controller.trigger_critical(cam.id, "smoke", f"Votes: {s_votes}", alert_id=alert_id)

        # 3. Check Zones: PPE Compliance & Restricted Smoking
        for zone in cam.zones:
            # Filter detections inside zone polygon
            zone_detections = []
            for d in detections:
                cx, cy = box_center(d.bbox)
                if point_in_polygon([cx, cy], zone.polygon):
                    zone_detections.append(d)

            # Check Smoking in Restricted Zone
            if zone.type == "smoking_restricted":
                cigarettes = [d for d in zone_detections if d.class_name == "cigarette"]
                is_smoking = len(cigarettes) > 0
                smk_trig, smk_votes = self.voter.vote(
                    f"{cam.id}_{zone.id}_smoking", is_smoking,
                    self.config.voter.smoking_window, self.config.voter.smoking_threshold
                )
                if smk_trig:
                    alert_id = None
                    if self.cooldown.should_fire(f"{cam.id}_{zone.id}_smoking_alert"):
                        alert_id = self._emit_alert(
                            cam=cam,
                            zone_id=zone.id,
                            severity="WARNING",
                            alert_type="smoking",
                            items=["cigarette"],
                            confidence=cigarettes[0].confidence if cigarettes else 0.75,
                            votes=smk_votes,
                            bbox=cigarettes[0].bbox if cigarettes else [0, 0, 1, 1],
                            frame=frame
                        )
                    alarm_controller.trigger_warning(cam.id, "smoking", f"Zone: {zone.name} | Votes: {smk_votes}", alert_id=alert_id)

            # Check Person-PPE Association
            person_statuses = associate_person_ppe(zone_detections, zone.required_ppe)
            for idx, p_stat in enumerate(person_statuses):
                has_violation = len(p_stat.missing_items) > 0
                v_key = f"{cam.id}_{zone.id}_ppe_{p_stat.track_id or idx}"
                ppe_trig, ppe_votes = self.voter.vote(
                    v_key, has_violation,
                    self.config.voter.ppe_window, self.config.voter.ppe_threshold
                )

                if ppe_trig:
                    if self.cooldown.should_fire(v_key):
                        self._emit_alert(
                            cam=cam,
                            zone_id=zone.id,
                            severity=zone.severity,
                            alert_type="missing_ppe",
                            items=p_stat.missing_items,
                            confidence=0.88,
                            votes=ppe_votes,
                            bbox=p_stat.person_bbox,
                            frame=frame
                        )

        # 4. Render Annotations & Push to MJPEG Hub
        annotated = self._annotate_frame(frame, detections, cam.zones)
        frame_hub.update_frame(cam.id, annotated)

    def _emit_alert(self, cam, zone_id: str, severity: str, alert_type: str, items: List[str],
                    confidence: float, votes: str, bbox: List[float], frame: np.ndarray) -> str:
        """Builds alert schema, saves snapshot, and enqueues to transactional SQLite outbox."""
        alert_id = str(uuid.uuid4())
        ts = time.strftime("%Y-%m-%dT%H:%M:%S") + f".{(time.time()%1)*1000:03.0f}+05:30"

        # Save snapshot
        date_folder = self.snapshot_dir / time.strftime("%Y/%m/%d")
        date_folder.mkdir(parents=True, exist_ok=True)
        snapshot_file = date_folder / f"{alert_id}.jpg"
        cv2.imwrite(str(snapshot_file), frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])

        alert_payload = {
            "id": alert_id,
            "ts": ts,
            "camera_id": cam.id,
            "sector": cam.sector,
            "zone_id": zone_id,
            "severity": severity,
            "type": alert_type,
            "items": items,
            "confidence": round(confidence, 2),
            "votes": votes,
            "model_version": Path(self.config.model_path).stem,
            "snapshot_path": str(snapshot_file).replace("\\", "/"),
            "bbox": [round(c, 4) for c in bbox]
        }

        self.outbox.enqueue_alert(alert_payload)
        logger.info(f"[ALERT EMITTED] {severity} - {alert_type} on {cam.id} ({votes})")
        return alert_id

    def _annotate_frame(self, frame: np.ndarray, detections: List[Detection], zones: list) -> np.ndarray:
        """Draws zone boundaries, detection bboxes, labels, and telemetry."""
        img = frame.copy()
        h, w = img.shape[:2]

        # Draw zones
        for z in zones:
            if len(z.polygon) >= 3:
                pts = np.array([[int(p[0] * w), int(p[1] * h)] for p in z.polygon], np.int32)
                pts = pts.reshape((-1, 1, 2))
                zone_color = (0, 0, 220) if z.type == "smoking_restricted" else (0, 200, 255)
                cv2.polylines(img, [pts], isClosed=True, color=zone_color, thickness=2)
                cv2.putText(img, f"ZONE: {z.name}", (pts[0][0][0], max(20, pts[0][0][1] - 8)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, zone_color, 1)

        # Draw detections
        for d in detections:
            x1, y1 = int(d.bbox[0] * w), int(d.bbox[1] * h)
            x2, y2 = int(d.bbox[2] * w), int(d.bbox[3] * h)
            color = COLORS.get(d.class_name, (200, 200, 200))

            cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
            lbl = f"{d.class_name} {d.confidence:.2f}"
            cv2.rectangle(img, (x1, max(0, y1 - 18)), (x1 + len(lbl) * 8, y1), color, -1)
            cv2.putText(img, lbl, (x1 + 2, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)

        return img


def main():
    parser = argparse.ArgumentParser(description="Factory Safety AI - Edge Daemon")
    parser.add_argument("--config", default="edge_config.json", help="Path to config JSON")
    args = parser.parse_args()

    cfg = load_config(args.config)
    worker = EdgeWorker(cfg)

    def _sig_handler(sig, frame):
        print("\n[*] Interrupted by user. Terminating edge worker...")
        worker.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, _sig_handler)
    signal.signal(signal.SIGTERM, _sig_handler)

    worker.start()

if __name__ == "__main__":
    main()
