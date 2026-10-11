import json
import time
from pathlib import Path
from types import SimpleNamespace
import cv2
import numpy as np
import pytest
from app.alarm import LocalAlarmController
from app.config import EdgeConfig, CameraConfig, ThresholdsConfig, load_config
from app.infer import get_inference_engine, MockInferenceEngine
from app.postprocess import Detection, associate_person_ppe, TemporalVoter, AlertCooldown
from app.stream import VideoStreamReader
from app.main import EdgeWorker
import app.main as worker_module

def test_alarm_is_asserted_before_failed_storage(monkeypatch, tmp_path):
    controller = LocalAlarmController()
    order = []
    monkeypatch.setattr(controller, "_output", lambda active: order.append(("output", active)))
    monkeypatch.setattr(worker_module, "alarm_controller", controller)
    worker = object.__new__(EdgeWorker)
    worker.config = EdgeConfig(mode="mock")
    worker._incidents = {}
    worker.voter = TemporalVoter()
    worker.cooldown = AlertCooldown(60)
    worker._pending_memory = {}
    worker.snapshot_dir = tmp_path
    def fail_storage(payload):
        order.append(("storage", payload["id"]))
        raise OSError("Test storage failure")
    worker.outbox = SimpleNamespace(enqueue_alert=fail_storage)
    camera = CameraConfig(id="test-camera", name="Test", zones=[])
    detection = Detection(class_id=8, class_name="fire", confidence=.9, bbox=[.1,.1,.4,.4])
    frame = np.zeros((64,64,3), dtype=np.uint8)
    worker._hazard(camera, frame, "test-fire", True, [detection], "fire", 5, 2, "global")
    worker._hazard(camera, frame, "test-fire", True, [detection], "fire", 5, 2, "global")
    assert order[0] == ("output", True)
    assert order[1][0] == "storage"
    assert controller.active_critical
    assert controller.active_ids() == list(worker._pending_memory)

def test_unrelated_clear_cannot_silence_a_new_alarm():
    controller = LocalAlarmController()
    controller.trigger_critical("cam","fire",alert_id="critical-a")
    controller.unlatch(["different-id"])
    assert controller.active_critical
    controller.unlatch(["critical-a"])
    assert not controller.active_critical
    controller.trigger_critical("cam","fire",alert_id="critical-a")
    assert not controller.active_critical
    controller.trigger_critical("cam","fire",alert_id="critical-b")
    assert controller.active_critical

def test_alarm_restart_restores_matching_pending_ids(tmp_path):
    state = str(tmp_path / "alarm.json")
    before = LocalAlarmController(state_path=state)
    before.trigger_critical("cam","fire",alert_id="persistent")
    after = LocalAlarmController(state_path=state)
    assert after.active_ids() == ["persistent"]
    assert after.active_critical
    after.unlatch(["persistent"])
    restored = LocalAlarmController(state_path=state)
    assert not restored.active_critical
    assert restored.active_ids() == []

def test_warning_does_not_keep_acknowledged_critical_relay_latched():
    controller = LocalAlarmController()
    controller.trigger_critical("cam","fire",alert_id="fire")
    controller.trigger_warning("cam","smoking",alert_id="warning")
    controller.unlatch(["fire"])
    assert not controller.active_critical
    assert controller.active_warning
    assert controller.active_ids() == ["warning"]

def test_ppe_outside_person_is_not_credited():
    items = [Detection(class_id=0,class_name="person",confidence=.9,bbox=[.4,.5,.6,.8]),
             Detection(class_id=1,class_name="helmet",confidence=.9,bbox=[.45,.1,.55,.2]),
             Detection(class_id=4,class_name="gloves",confidence=.9,bbox=[.45,.1,.55,.2]),
             Detection(class_id=5,class_name="boots",confidence=.9,bbox=[.45,.9,.55,1])]
    person = associate_person_ppe(items,["helmet","gloves","boots"])[0]
    assert set(person.missing_items) == {"helmet","gloves","boots"}

def test_cached_frames_are_not_repeated_temporal_votes():
    reader = VideoStreamReader("cam")
    reader._frame = np.zeros((5,5,3), dtype=np.uint8)
    reader._sequence = 1
    reader.last_frame_at = time.time()
    assert reader.read()[0]
    assert not reader.read()[0]
    reader._sequence = 2
    reader.last_frame_at = time.time() - 3
    assert not reader.read()[0]

def test_mock_detector_requires_explicit_mode():
    with pytest.raises(FileNotFoundError):
        get_inference_engine("does-not-exist.onnx",ThresholdsConfig())
    assert isinstance(get_inference_engine("does-not-exist.onnx",ThresholdsConfig(),mode="mock"),MockInferenceEngine)

def test_invalid_config_never_falls_back_to_demo(tmp_path):
    source = tmp_path / "invalid.json"
    source.write_text("{broken")
    with pytest.raises(ValueError):
        load_config(str(source))

def test_forensics_real_model_reports_unknown_compliance_for_empty_video(tmp_path):
    from app.forensics_server import stream_video
    video = tmp_path / "blank.avi"
    writer = cv2.VideoWriter(str(video),cv2.VideoWriter_fourcc(*"MJPG"),10,(160,120))
    assert writer.isOpened()
    for _ in range(10):
        writer.write(np.zeros((120,160,3),dtype=np.uint8))
    writer.release()
    values = [json.loads(event.removeprefix("data:").strip()) for event in stream_video(str(video),"blank.avi","test")]
    final = next(value for value in values if value["type"] == "done")
    assert final["frames_analyzed"] == 2
    assert final["people_detected"] == 0
    assert final["compliance_score"] is None
    assert final["critical_events"] == 0
    assert not final["truncated"]
