"""Edge orchestration: fresh-frame decisions, local latch, durable delivery and config sync."""
import argparse
import logging
import signal
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
import cv2
from app.config import EdgeConfig, load_config
from app.stream import VideoStreamReader
from app.infer import get_inference_engine, MockInferenceEngine
from app.postprocess import associate_person_ppe, point_in_polygon, box_center, TemporalVoter, AlertCooldown, filter_and_validate_detections
from app.alarm import alarm_controller, LocalAlarmController
from app.outbox import OutboxManager
from app.mjpeg import frame_hub, start_mjpeg_server
from app.heartbeat import HeartbeatClient
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("edge.main")

class EdgeWorker:
    def __init__(self, config: EdgeConfig):
        self.config = config
        self.running = False
        self._lock = threading.RLock()
        self._incidents = {}
        self._pending_memory = {}
        self.voter = TemporalVoter()
        self.cooldown = AlertCooldown(config.cooldown_seconds)
        self.engine = get_inference_engine(config.model_path, config.thresholds, config.mode)
        self.outbox = OutboxManager(config.db_path, api_key=config.api_key)
        configured = LocalAlarmController(config.relay_pin, state_path=str(Path(config.db_path).with_name("alarm_state.json")))
        alarm_controller.__dict__.update(configured.__dict__)
        self.snapshot_dir = Path(config.snapshot_dir)
        self.readers = {c.id: VideoStreamReader(c.id, c.source, c.fps_target) for c in config.cameras}
        self.fps_counters = {c.id: 0.0 for c in config.cameras}
        self.latency_ms = {c.id: 0.0 for c in config.cameras}
        self._processed_at = {}
        self.heartbeat = HeartbeatClient(config.server_url, config.node_id, config.api_key, config.heartbeat_interval_sec, self._apply_config)
        self.heartbeat.set_telemetry_providers(lambda: self.fps_counters.copy(), lambda: self.latency_ms.copy(), self._camera_telemetry)
        self.heartbeat.detector_mode_provider = lambda: "mock" if isinstance(self.engine, MockInferenceEngine) else "onnx"
        self.heartbeat.alarm_adapter_provider = lambda: "gpio" if alarm_controller.gpio_available else "unconfigured"
        self._mjpeg = None

    def _camera_telemetry(self):
        with self._lock:
            return [{"id": key, "status": "online" if reader.last_frame_at and time.time()-reader.last_frame_at < 15 else "stalled",
                     "lastFrameAt": datetime.fromtimestamp(reader.last_frame_at, timezone.utc).isoformat() if reader.last_frame_at else None,
                     "fps": self.fps_counters.get(key, 0), "latencyMs": self.latency_ms.get(key, 0)} for key, reader in self.readers.items()]

    def _apply_config(self, _version):
        try:
            response = requests.get(self.config.server_url + "/edge/config", headers={"X-Edge-Api-Key": self.config.api_key}, timeout=5)
            response.raise_for_status()
            payload = response.json()
            values = self.config.model_dump()
            for key in ["cameras", "thresholds", "voter", "cooldown_seconds"]:
                if key in payload:
                    values[key] = payload[key]
            selected = payload.get("activeModel")
            model_names = {"best_s5": "best_s5.onnx", "best_s4": "best_s4.onnx", "ppe_v1_s2_yolo11s": "best_s2.onnx"}
            if selected in model_names:
                values["model_path"] = str(Path(self.config.model_path).parent / model_names[selected])
            updated = EdgeConfig(**values)
            engine = get_inference_engine(updated.model_path, updated.thresholds, updated.mode)
            with self._lock:
                for key, reader in list(self.readers.items()):
                    new = next((c for c in updated.cameras if c.id == key), None)
                    if not new or new.source != reader.source or new.fps_target != reader.fps_target:
                        reader.stop()
                        del self.readers[key]
                for camera in updated.cameras:
                    if camera.id not in self.readers:
                        self.readers[camera.id] = VideoStreamReader(camera.id, camera.source, camera.fps_target).start()
                self.config = updated
                self.engine = engine
                self.voter = TemporalVoter()
                self.cooldown = AlertCooldown(updated.cooldown_seconds)
                self.fps_counters = {c.id: self.fps_counters.get(c.id, 0) for c in updated.cameras}
                self.latency_ms = {c.id: self.latency_ms.get(c.id, 0) for c in updated.cameras}
            return True
        except Exception:
            logger.exception("Configuration was not applied; keeping last working configuration")
            return False

    def start(self):
        self.running = True
        self._apply_config(0)
        self.outbox.start_worker(self.config.server_url)
        for reader in self.readers.values():
            reader.start()
        self._mjpeg = start_mjpeg_server(self.config.mjpeg_port)
        self.heartbeat.start()
        self._run_loop()

    def stop(self):
        self.running = False
        self.heartbeat.stop()
        for reader in self.readers.values():
            reader.stop()
        self.outbox.stop_worker()
        if self._mjpeg:
            self._mjpeg.shutdown()
        # Preserve latched GPIO and persisted IDs until supervisor-confirmed clearing.

    def _run_loop(self):
        while self.running:
            with self._lock:
                for camera in self.config.cameras:
                    reader = self.readers.get(camera.id)
                    if not reader:
                        continue
                    valid, frame = reader.read()
                    if not valid:
                        continue
                    now = time.monotonic()
                    try:
                        self._process_camera_frame(camera, frame)
                        self.latency_ms[camera.id] = round((time.monotonic()-now)*1000, 1)
                        previous = self._processed_at.get(camera.id, now)
                        self.fps_counters[camera.id] = round(1/max(time.monotonic()-previous, .001), 1) if previous != now else 0
                        self._processed_at[camera.id] = time.monotonic()
                    except Exception:
                        logger.exception("Camera processing failed: %s", camera.id)
                for alert_id, payload in list(self._pending_memory.items()):
                    try:
                        self.outbox.enqueue_alert(payload)
                        del self._pending_memory[alert_id]
                    except Exception:
                        break
            time.sleep(.01)

    def _hazard(self, cam, frame, key, present, detections, kind, window, threshold, zone):
        triggered, votes = self.voter.vote(key, present, window, threshold)
        if not triggered:
            self._incidents.pop(key, None)
            return
        if key in self._incidents:
            return
        if not self.cooldown.should_fire(key):
            return
        alert_id = str(uuid.uuid4())
        self._incidents[key] = alert_id
        detector = detections[0] if detections else None
        if kind in ["fire", "smoke"]:
            alarm_controller.trigger_critical(cam.id, kind, votes, alert_id=alert_id)
        elif kind == "smoking":
            alarm_controller.trigger_warning(cam.id, kind, votes, alert_id=alert_id)
        self._emit_alert(cam, zone, "CRITICAL" if kind in ["fire","smoke"] else "WARNING", kind,
                         ["cigarette" if kind == "smoking" else kind], detector.confidence if detector else 0,
                         votes, detector.bbox if detector else [0,0,1,1], frame, alert_id)

    def _process_camera_frame(self, cam, frame):
        detections = self.engine.infer(frame)
        detections = filter_and_validate_detections(detections)
        for kind in ["fire", "smoke"]:
            found = [d for d in detections if d.class_name == kind]
            self._hazard(cam, frame, cam.id+"_"+kind, bool(found), found, kind,
                         getattr(self.config.voter, kind+"_window"), getattr(self.config.voter, kind+"_threshold"), "global")
        for zone in cam.zones:
            if zone.type == "exclusion":
                continue
            selected = [d for d in detections if point_in_polygon(box_center(d.bbox), zone.polygon)]
            if zone.type == "smoking_restricted":
                found = [d for d in selected if d.class_name == "cigarette"]
                self._hazard(cam, frame, cam.id+"_"+zone.id+"_smoking", bool(found), found, "smoking", self.config.voter.smoking_window, self.config.voter.smoking_threshold, zone.id)
            people = associate_person_ppe(selected, zone.required_ppe)
            for item in zone.required_ppe:
                violations = [person for person in people if item in person.missing_items]
                key = cam.id+"_"+zone.id+"_ppe_"+item
                triggered, votes = self.voter.vote(key, bool(violations), self.config.voter.ppe_window, self.config.voter.ppe_threshold)
                if triggered and self.cooldown.should_fire(key):
                    anchors = [d for d in selected if d.class_name == "person"]
                    self._emit_alert(cam, zone.id, "COMPLIANCE", "missing_ppe", [item], max((d.confidence for d in anchors), default=0), votes, violations[0].person_bbox if violations else [0,0,1,1], frame)
        annotated = frame.copy()
        h, w = frame.shape[:2]
        font_scale = max(0.65, min(1.15, w / 1150.0))
        font_thick = max(2, int(round(font_scale * 2.2)))
        box_thick = max(2, int(round(w / 450.0)))
        pad_x = max(5, int(font_scale * 7))
        pad_y = max(4, int(font_scale * 5))

        for detection in detections:
            x1, y1, x2, y2 = [int(v * s) for v, s in zip(detection.bbox, [w, h, w, h])]
            x1, y1 = max(0, min(w - 1, x1)), max(0, min(h - 1, y1))
            x2, y2 = max(0, min(w - 1, x2)), max(0, min(h - 1, y2))
            is_violation = detection.class_name in ["fire", "smoke", "head", "no_gloves", "no_boots"]
            color = (30, 30, 240) if is_violation else (0, 220, 0)
            if detection.class_name in ["fire", "smoke"]:
                color = (0, 100, 255)
            elif detection.class_name == "cigarette":
                color = (0, 165, 255)

            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, box_thick)
            lbl = f"{detection.class_name.upper().replace('_', ' ')} {detection.confidence:.0%}"
            (tw, th), _ = cv2.getTextSize(lbl, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thick)

            badge_y1 = y1 - th - 2 * pad_y
            badge_y2 = y1
            text_y = y1 - pad_y
            if badge_y1 < 0:
                badge_y1 = y1
                badge_y2 = y1 + th + 2 * pad_y
                text_y = y1 + th + pad_y

            badge_x2 = min(w - 1, x1 + tw + 2 * pad_x)
            cv2.rectangle(annotated, (x1, badge_y1), (badge_x2, badge_y2), color, -1)

            brightness = color[0] * 0.114 + color[1] * 0.587 + color[2] * 0.299
            text_color = (0, 0, 0) if brightness > 150 else (255, 255, 255)
            cv2.putText(annotated, lbl, (x1 + pad_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, font_scale, text_color, font_thick, cv2.LINE_AA)

        if self.config.mode == "mock" or cam.source == "synthetic":
            cv2.putText(annotated, "DEMONSTRATION FEED", (12, 45), cv2.FONT_HERSHEY_SIMPLEX, .55, (0, 170, 255), 2)
        frame_hub.update_frame(cam.id, annotated)

    def _emit_alert(self, cam, zone_id, severity, alert_type, items, confidence, votes, bbox, frame, alert_id=None):
        alert_id = alert_id or str(uuid.uuid4())
        payload = {"id":alert_id,"ts":datetime.now(timezone.utc).isoformat(),"camera_id":cam.id,"sector":cam.sector,"zone_id":zone_id,
                   "severity":severity,"type":alert_type,"items":items,"confidence":round(confidence,3),"votes":votes,
                   "model_version":Path(self.config.model_path).stem,"bbox":bbox}
        try:
            directory = self.snapshot_dir / datetime.now(timezone.utc).strftime("%Y/%m/%d")
            directory.mkdir(parents=True, exist_ok=True)
            snapshot = directory / (alert_id+".jpg")
            if cv2.imwrite(str(snapshot),frame):
                payload["snapshot_path"] = str(snapshot)
        except Exception:
            logger.exception("Snapshot storage unavailable; local alarm remains latched")
        try:
            self.outbox.enqueue_alert(payload)
        except Exception:
            self._pending_memory[alert_id] = payload
            logger.exception("Outbox storage unavailable; retaining incident in memory")
        return alert_id

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="edge_config.json")
    args = parser.parse_args()
    worker = EdgeWorker(load_config(args.config))
    def stop(*_):
        worker.stop()
        raise SystemExit(0)
    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    worker.start()

if __name__ == "__main__":
    main()
