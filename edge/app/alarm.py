"""Local, network-independent alarm state and optional GPIO adapter."""
import json
import logging
import os
import threading
from pathlib import Path
from typing import Optional

logger = logging.getLogger("edge.alarm")

class LocalAlarmController:
    def __init__(self, relay_pin: Optional[int] = None, enable_sound: bool = True, state_path: Optional[str] = None):
        self.relay_pin = relay_pin
        self.enable_sound = enable_sound
        self.active_critical = False
        self.active_warning = False
        self.active_alert_ids = set()
        self.critical_alert_ids = set()
        self.cleared_alert_ids = set()
        self.gpio_available = False
        self._lock = threading.RLock()
        self.state_path = Path(state_path) if state_path else None
        if relay_pin is not None:
            try:
                import RPi.GPIO as GPIO
                GPIO.setmode(GPIO.BCM)
                GPIO.setup(relay_pin, GPIO.OUT)
                self.gpio_available = True
            except Exception:
                logger.error("GPIO adapter unavailable; no physical output is configured.")
        if self.state_path and self.state_path.exists():
            try:
                saved = json.loads(self.state_path.read_text())
                self.active_alert_ids = set(saved.get("active", []))
                self.critical_alert_ids = set(saved.get("critical", saved.get("active", [])))
                self.cleared_alert_ids = set(saved.get("cleared", []))
                self.active_critical = bool(self.critical_alert_ids)
                self.active_warning = bool(self.active_alert_ids - self.critical_alert_ids)
                self._output(self.active_critical)
            except Exception:
                logger.error("Could not recover alarm state. Operator inspection required.")

    def _output(self, active):
        if self.gpio_available:
            try:
                import RPi.GPIO as GPIO
                GPIO.output(self.relay_pin, GPIO.HIGH if active else GPIO.LOW)
            except Exception:
                logger.exception("GPIO output failed")

    def _persist(self):
        if not self.state_path:
            return
        try:
            self.state_path.parent.mkdir(parents=True, exist_ok=True)
            temp = self.state_path.with_suffix(".tmp")
            temp.write_text(json.dumps({"active": sorted(self.active_alert_ids), "critical": sorted(self.critical_alert_ids), "cleared": sorted(self.cleared_alert_ids)}))
            temp.replace(self.state_path)
        except Exception:
            logger.exception("Alarm remains active; state persistence failed")

    def trigger_critical(self, camera_id, hazard_type, details="", alert_id=None):
        if not alert_id:
            raise ValueError("A stable incident ID is required for alarm activation")
        with self._lock:
            if alert_id in self.cleared_alert_ids:
                return
            # Assert the output before disk, logging or network operations.
            self._output(True)
            self.active_critical = True
            self.active_alert_ids.add(alert_id)
            self.critical_alert_ids.add(alert_id)
            self._persist()
        logger.warning("Local %s alarm: %s on %s", "GPIO" if self.gpio_available else "state-only", hazard_type, camera_id)

    def trigger_warning(self, camera_id, hazard_type, details="", alert_id=None):
        if not alert_id:
            raise ValueError("A stable incident ID is required")
        with self._lock:
            if alert_id not in self.cleared_alert_ids:
                self.active_warning = True
                self.active_alert_ids.add(alert_id)
                self._persist()

    def unlatch(self, clear_alert_ids):
        with self._lock:
            matched = self.active_alert_ids.intersection(clear_alert_ids)
            if not matched:
                return
            self.active_alert_ids.difference_update(matched)
            self.critical_alert_ids.difference_update(matched)
            self.cleared_alert_ids.update(matched)
            if not self.critical_alert_ids:
                self._output(False)
                self.active_critical = False
            self.active_warning = bool(self.active_alert_ids - self.critical_alert_ids)
            self._persist()

    def active_ids(self):
        with self._lock:
            return list(self.active_alert_ids)

    def silence(self):
        """Explicit maintenance operation, never used by normal worker shutdown."""
        with self._lock:
            self._output(False)
            self.active_alert_ids.clear()
            self.critical_alert_ids.clear()
            self.active_critical = self.active_warning = False
            self._persist()

alarm_controller = LocalAlarmController()
