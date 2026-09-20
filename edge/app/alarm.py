"""
Factory Safety AI - Local Edge Alarm Controller
Zero-cloud-dependency emergency alarm adapter.
Directly triggers factory buzzers, relays, and sirens with <100ms response time.
"""

import time
import logging
from typing import Optional

logger = logging.getLogger("edge.alarm")

class LocalAlarmController:
    """
    Direct hardware / local network alarm activator.
    Guarantees the critical alarm pathway works even if the factory LAN or cloud drops.
    """
    def __init__(self, relay_pin: Optional[int] = None, enable_sound: bool = True):
        self.relay_pin = relay_pin
        self.enable_sound = enable_sound
        self.active_critical = False
        self.active_warning = False
        self.active_alert_ids = set()
        self._last_trigger_time = 0.0

        # Attempt to import RPi.GPIO or mock hardware relay if available on physical edge box
        self.gpio_available = False
        if relay_pin is not None:
            try:
                import RPi.GPIO as GPIO # type: ignore
                GPIO.setmode(GPIO.BCM)
                GPIO.setup(relay_pin, GPIO.OUT)
                self.gpio_available = True
                logger.info(f"[*] Hardware GPIO Relay initialized on Pin {relay_pin}")
            except Exception:
                logger.info("[*] Physical GPIO not detected; operating in simulated hardware mode.")

    def trigger_critical(self, camera_id: str, hazard_type: str, details: str = "", alert_id: Optional[str] = None) -> None:
        """
        Immediately fires hardware siren/relay on CRITICAL hazards (Fire / Smoke).
        Must execute synchronously in under 10ms.
        """
        self.active_critical = True
        self._last_trigger_time = time.time()
        if alert_id:
            self.active_alert_ids.add(alert_id)

        print(f"\n" + "!" * 65)
        print(f" [LOCAL SIREN TRIGGERED] CRITICAL HAZARD: {hazard_type.upper()}")
        print(f" Camera: {camera_id} | Time: {time.strftime('%Y-%m-%d %H:%M:%S')} | {details}")
        if alert_id:
            print(f" Alert ID: {alert_id}")
        print("!" * 65 + "\n")

        if self.gpio_available and self.relay_pin is not None:
            try:
                import RPi.GPIO as GPIO # type: ignore
                GPIO.output(self.relay_pin, GPIO.HIGH)
            except Exception as e:
                logger.error(f"[!] GPIO relay write failed: {e}")

    def trigger_warning(self, camera_id: str, hazard_type: str, details: str = "", alert_id: Optional[str] = None) -> None:
        """Fires warning buzzer (e.g. Smoking in restricted zone)."""
        self.active_warning = True
        if alert_id:
            self.active_alert_ids.add(alert_id)
        print(f"\n[ALARM WARNING] {hazard_type.upper()} on {camera_id}: {details}")

    def unlatch(self, clear_alert_ids: list) -> None:
        """
        Unlatches the physical relay when supervisor acknowledges/resolves alerts on the server.
        """
        if not clear_alert_ids:
            return

        cleared_any = False
        for aid in clear_alert_ids:
            if aid == "*" or aid in self.active_alert_ids:
                if aid in self.active_alert_ids:
                    self.active_alert_ids.remove(aid)
                cleared_any = True

        if "*" in clear_alert_ids or len(self.active_alert_ids) == 0:
            if self.active_critical or self.active_warning:
                logger.info(f"[*] All active alarm IDs cleared ({clear_alert_ids}). Unlatching physical siren/relay.")
                self.silence()
        elif cleared_any:
            logger.info(f"[*] Partially cleared alert IDs. Remaining active alarms: {len(self.active_alert_ids)}")

    def silence(self) -> None:
        """Silences all active buzzers and resets relays."""
        self.active_critical = False
        self.active_warning = False
        self.active_alert_ids.clear()
        if self.gpio_available and self.relay_pin is not None:
            try:
                import RPi.GPIO as GPIO # type: ignore
                GPIO.output(self.relay_pin, GPIO.LOW)
            except Exception:
                pass
        print("[*] Local alarm silenced and relay reset.")

# Global singleton
alarm_controller = LocalAlarmController()
