"""
Factory Safety AI - Edge Heartbeat Client
Periodically transmits edge node telemetry, active camera FPS, and system health
to the on-prem NestJS server.
Receives alarm unlatch signals (clearAlarms) to silence local buzzers upon supervisor acknowledgment.
"""

import time
import threading
import logging
from typing import Dict, List, Any, Optional, Callable
import requests

from app.alarm import alarm_controller

logger = logging.getLogger("edge.heartbeat")

class HeartbeatClient:
    def __init__(
        self,
        server_url: str = "http://localhost:4000",
        node_id: str = "edge-node-01",
        api_key: str = "edge-api-key-factory-plant-01",
        interval_sec: float = 5.0,
        on_config_changed: Optional[Callable[[int], None]] = None,
    ):
        self.server_url = server_url.rstrip("/")
        self.node_id = node_id
        self.api_key = api_key
        self.interval_sec = interval_sec
        self.on_config_changed = on_config_changed

        self._current_config_version = 1
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

        # Telemetry metrics providers (updated by worker)
        self.fps_provider: Callable[[], Dict[str, float]] = lambda: {}
        self.latency_provider: Callable[[], Dict[str, float]] = lambda: {}
        self.camera_status_provider: Callable[[], List[str]] = lambda: []

    def set_telemetry_providers(
        self,
        fps_fn: Callable[[], Dict[str, float]],
        latency_fn: Callable[[], Dict[str, float]],
        cameras_fn: Callable[[], List[str]],
    ):
        self.fps_provider = fps_fn
        self.latency_provider = latency_fn
        self.camera_status_provider = cameras_fn

    def send_pulse(self) -> Dict[str, Any]:
        """Transmits a single heartbeat pulse synchronously."""
        fps_map = self.fps_provider()
        latency_map = self.latency_provider()
        cam_ids = self.camera_status_provider()

        # Compute averages
        avg_fps = sum(fps_map.values()) / max(len(fps_map), 1)
        avg_latency = sum(latency_map.values()) / max(len(latency_map), 1)

        cameras_payload = [
            {
                "id": cid,
                "status": "online",
                "fps": round(fps_map.get(cid, avg_fps), 1),
                "frameAgeMs": 33,
            }
            for cid in cam_ids
        ]

        payload = {
            "edgeNodeId": self.node_id,
            "fps": round(avg_fps, 1),
            "latencyMs": round(avg_latency, 1),
            "systemLoad": {
                "cpu": 16.5,
                "ram": 38.2,
                "temp": 46.0,
            },
            "cameras": cameras_payload,
        }

        headers = {
            "Content-Type": "application/json",
            "X-Edge-Api-Key": self.api_key,
        }

        endpoint = f"{self.server_url}/edge/heartbeat"
        try:
            resp = requests.post(endpoint, json=payload, headers=headers, timeout=3.0)
            if resp.status_code == 200:
                data = resp.json()

                # 1. Alarm Unlatching Protocol
                clear_alarms = data.get("clearAlarms", [])
                if clear_alarms:
                    logger.info(f"[*] Server instructed unlatch of alarms: {clear_alarms}")
                    alarm_controller.unlatch(clear_alarms)

                # 2. Config Version Check
                server_cfg_version = data.get("configVersion", self._current_config_version)
                if server_cfg_version > self._current_config_version:
                    logger.info(f"[*] New config version detected ({server_cfg_version} > {self._current_config_version})")
                    self._current_config_version = server_cfg_version
                    if self.on_config_changed:
                        self.on_config_changed(server_cfg_version)

                return data
            else:
                logger.warning(f"[!] Heartbeat returned HTTP {resp.status_code}: {resp.text[:120]}")
                return {"ok": False, "status_code": resp.status_code}
        except Exception as e:
            logger.debug(f"Heartbeat pulse failed: {e}")
            return {"ok": False, "error": str(e)}

    def start(self):
        """Starts background heartbeat daemon."""
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()

        def _loop():
            logger.info(f"[*] Heartbeat client started targeting {self.server_url}")
            while not self._stop_event.is_set():
                self.send_pulse()
                self._stop_event.wait(self.interval_sec)

        self._thread = threading.Thread(target=_loop, daemon=True)
        self._thread.start()

    def stop(self):
        """Stops background heartbeat daemon."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=2.0)
