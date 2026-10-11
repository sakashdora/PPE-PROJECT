"""Offline review probes. Uses no network, device, production data, or model inference.

Run with the bundled Python 3.12 runtime. Existing venv pure packages/OpenCV are
reused after importing its compatible bundled NumPy and Pydantic dependencies.
"""
import asyncio
import io
import json
import os
import sys
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
import pydantic

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / ".venv" / "Lib" / "site-packages"))
sys.path.insert(0, str(ROOT / "edge"))

from app.config import CameraConfig, EdgeConfig, ThresholdsConfig, ZoneConfig
from app.postprocess import AlertCooldown, Detection, TemporalVoter, associate_person_ppe
from app.infer import get_inference_engine
from app.heartbeat import HeartbeatClient
from app.main import EdgeWorker
from app.alarm import LocalAlarmController

results = {}

def detection(name, bbox):
    return Detection(class_id=0, class_name=name, confidence=0.99, bbox=bbox)

person = detection("person", [.4, .5, .6, .8])
irrelevant_ppe = [
    detection("helmet", [.45, .1, .55, .2]),
    detection("gloves", [.45, .1, .55, .2]),
    detection("boots", [.45, .9, .55, 1.0]),
]
status = associate_person_ppe([person] + irrelevant_ppe, ["helmet", "gloves", "boots"])[0]
results["ppe_outside_person"] = status.model_dump()

worker = EdgeWorker.__new__(EdgeWorker)
worker.config = EdgeConfig()
worker.voter = TemporalVoter()
worker.cooldown = AlertCooldown(60)
worker.engine = SimpleNamespace(infer=lambda frame: [detection("fire", [.1, .1, .2, .2])])
worker._annotate_frame = lambda *args: args[0]
worker._emit_alert = lambda **kwargs: (_ for _ in ()).throw(OSError("simulated disk failure"))
frame = np.zeros((32, 32, 3), dtype=np.uint8)
camera = CameraConfig(id="audit", name="audit", zones=[])
with patch("app.main.frame_hub.update_frame"), patch("app.main.alarm_controller.trigger_critical") as alarm:
    worker._process_camera_frame(camera, frame)
    try:
        worker._process_camera_frame(camera, frame)
    except OSError as exc:
        results["disk_failure_alarm"] = {"raised": str(exc), "alarm_calls": alarm.call_count}

with redirect_stdout(io.StringIO()):
    controller = LocalAlarmController()
    controller.trigger_critical("audit", "fire", alert_id="first")
    controller.unlatch(["first"])
    controller.trigger_critical("audit", "fire", alert_id=None)
    results["cooldown_retrigger"] = {"active": controller.active_critical, "active_ids": list(controller.active_alert_ids)}
    controller.unlatch(["unrelated_old_id"])
    results["unrelated_clear_after_retrigger"] = {"active": controller.active_critical, "active_ids": list(controller.active_alert_ids)}

hb = HeartbeatClient()
hb.set_telemetry_providers(lambda: {"stalled": 0.0}, lambda: {"stalled": 0.0}, lambda: ["stalled"])
with patch("app.heartbeat.requests.post", return_value=SimpleNamespace(status_code=200, json=lambda: {"configVersion": 2})) as post:
    hb.send_pulse()
    results["stalled_camera_telemetry"] = post.call_args.kwargs["json"]
    results["config_reload_callback"] = {"callback": hb.on_config_changed, "version_after_pulse": hb._current_config_version}

with patch.dict(os.environ, {"MODEL_PATH": "review-test-model.onnx", "SERVER_URL": "http://invalid.test"}):
    cfg = EdgeConfig()
    results["env_config"] = {"model_path": cfg.model_path, "server_url": cfg.server_url}
engine = get_inference_engine(str(ROOT / "audit" / "known_missing_model.onnx"), ThresholdsConfig())
results["missing_model_fallback"] = {"engine": type(engine).__name__, "classes_on_empty_frame": [d.class_name for d in engine.infer(frame)]}

ppe_worker = EdgeWorker.__new__(EdgeWorker)
ppe_worker.config = EdgeConfig()
ppe_worker.voter = TemporalVoter()
ppe_worker.cooldown = AlertCooldown(60)
ppe_worker._annotate_frame = lambda *args: args[0]
ppe_observations = [[person]] * 7 + [[]] * 20 + [[detection("person", [.1, .1, .3, .6])]]
ppe_queue = iter(ppe_observations)
ppe_worker.engine = SimpleNamespace(infer=lambda frame: next(ppe_queue))
ppe_camera = CameraConfig(id="audit", name="audit", zones=[ZoneConfig(id="zone", name="zone", polygon=[], required_ppe=["helmet"])])
with patch("app.main.frame_hub.update_frame"), patch.object(ppe_worker, "_emit_alert", return_value="offline-probe") as emit:
    for observation in ppe_observations:
        ppe_worker._process_camera_frame(ppe_camera, frame)
    results["ppe_vote_survives_absence_and_person_change"] = {"alert_count": emit.call_count, "votes": emit.call_args.kwargs["votes"]}

try:
    from app import forensics_server as fs

    class OneFrame:
        def __init__(self, *args):
            self.once = False
        def isOpened(self):
            return True
        def get(self, prop):
            return 1.0 if prop == fs.cv2.CAP_PROP_FRAME_COUNT else 25.0
        def read(self):
            if self.once:
                return False, None
            self.once = True
            return True, frame
        def release(self):
            pass

    async def run_forensics():
        with patch.object(fs.cv2, "VideoCapture", OneFrame), patch.object(fs, "get_engine", return_value=SimpleNamespace(infer=lambda frame: [person])):
            async for event in fs.stream_video("audit.mp4", "audit.mp4", "audit"):
                data = json.loads(event.removeprefix("data: "))
                if data["type"] == "done":
                    return {k: data[k] for k in ["compliance_score", "ppe_violations", "class_counts"]}

    results["forensics_person_without_detected_ppe"] = asyncio.run(run_forensics())
except ImportError as exc:
    results["forensics_probe_blocked"] = str(exc)

print(json.dumps(results, indent=2))
