"""Measured edge heartbeat and supervisor-confirmed alarm clearing."""
import threading
import logging
import requests
from app.alarm import alarm_controller
logger = logging.getLogger("edge.heartbeat")

class HeartbeatClient:
    def __init__(self, server_url="http://localhost:4000", node_id="edge-node-01", api_key="edge-api-key-factory-plant-01", interval_sec=5.0, on_config_changed=None):
        self.server_url = server_url.rstrip("/")
        self.node_id = node_id
        self.api_key = api_key
        self.interval_sec = interval_sec
        self.on_config_changed = on_config_changed
        self._current_config_version = 0
        self._stop_event = threading.Event()
        self._thread = None
        self.fps_provider = lambda: {}
        self.latency_provider = lambda: {}
        self.camera_status_provider = lambda: []
        self.detector_mode_provider = lambda: "unknown"
        self.alarm_adapter_provider = lambda: "unconfigured"

    def set_telemetry_providers(self, fps_fn, latency_fn, cameras_fn):
        self.fps_provider, self.latency_provider, self.camera_status_provider = fps_fn, latency_fn, cameras_fn

    def send_pulse(self):
        fps_map, latency_map = self.fps_provider(), self.latency_provider()
        cameras = self.camera_status_provider()
        payload = {"edgeNodeId": self.node_id, "fps": sum(fps_map.values()), "latencyMs": sum(latency_map.values()) / max(len(latency_map), 1),
                   "cameras": cameras, "activeAlertIds": alarm_controller.active_ids(), "appliedConfigVersion": self._current_config_version, "detectorMode": self.detector_mode_provider(), "alarmAdapter": self.alarm_adapter_provider()}
        try:
            response = requests.post(self.server_url + "/edge/heartbeat", json=payload, headers={"X-Edge-Api-Key": self.api_key}, timeout=3)
            response.raise_for_status()
            data = response.json()
            alarm_controller.unlatch(data.get("clearAlarms", []))
            version = data.get("configVersion", 1)
            if version > self._current_config_version and self.on_config_changed:
                if self.on_config_changed(version):
                    self._current_config_version = version
            return data
        except Exception as error:
            logger.debug("Heartbeat failed: %s", error)
            return {"ok": False}

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        def loop():
            while not self._stop_event.is_set():
                self.send_pulse()
                self._stop_event.wait(self.interval_sec)
        self._thread = threading.Thread(target=loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=4)
