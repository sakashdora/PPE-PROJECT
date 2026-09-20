"""
Factory Safety AI - Video Stream Ingestion
Threaded, low-latency RTSP and Synthetic video capture engine with automatic reconnect.
Decouples capture from inference to prevent buffer latency buildup.
"""

import time
import threading
import logging
from typing import Optional, Tuple
import numpy as np

logger = logging.getLogger("edge.stream")

class VideoStreamReader:
    """
    Non-blocking threaded video capture.
    Always provides the most recent frame; drops backlogged frames.
    """
    def __init__(self, camera_id: str, source: str = "synthetic", fps_target: int = 10):
        self.camera_id = camera_id
        self.source = source
        self.fps_target = fps_target
        self.interval = 1.0 / max(1, fps_target)

        self._frame: Optional[np.ndarray] = None
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._frame_count = 0

    def start(self) -> "VideoStreamReader":
        if self._running:
            return self
        self._running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()
        logger.info(f"[*] Stream started for {self.camera_id} (source: {self.source})")
        return self

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=2.0)

    def read(self) -> Tuple[bool, Optional[np.ndarray]]:
        """Returns (is_new_or_valid, frame)."""
        with self._lock:
            if self._frame is not None:
                return True, self._frame.copy()
        return False, None

    def _capture_loop(self) -> None:
        if self.source == "synthetic":
            self._synthetic_loop()
        else:
            self._opencv_loop()

    def _synthetic_loop(self) -> None:
        """Generates realistic synthetic factory video frames."""
        import cv2

        width, height = 640, 480
        while self._running:
            start_t = time.time()
            self._frame_count += 1

            # Base factory interior background
            frame = np.zeros((height, width, 3), dtype=np.uint8)
            frame[:, :] = (45, 52, 58)  # Slate factory floor tone

            # Grid lines simulating factory floor tiles
            for y in range(0, height, 40):
                cv2.line(frame, (0, y), (width, y), (55, 62, 70), 1)
            for x in range(0, width, 40):
                cv2.line(frame, (x, 0), (x, height), (55, 62, 70), 1)

            # Draw factory machinery silhouettes
            cv2.rectangle(frame, (50, 80), (220, 300), (35, 40, 45), -1)
            cv2.putText(frame, "CNC LATHE 01", (65, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 115, 130), 1)

            cv2.rectangle(frame, (380, 60), (590, 320), (30, 35, 40), -1)
            cv2.putText(frame, "HYDRAULIC PRESS", (400, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 115, 130), 1)

            # Live watermark & telemetry
            ts_str = time.strftime("%Y-%m-%d %H:%M:%S") + f".{(time.time()%1)*1000:03.0f}"
            cv2.putText(frame, f"CAM: {self.camera_id} | {ts_str}", (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 200), 1)

            with self._lock:
                self._frame = frame

            elapsed = time.time() - start_t
            sleep_time = max(0.001, self.interval - elapsed)
            time.sleep(sleep_time)

    def _opencv_loop(self) -> None:
        """Connects to real RTSP or video file with auto-reconnect backoff."""
        import cv2

        backoff = 1.0
        while self._running:
            logger.info(f"[*] Connecting to stream: {self.source}")
            cap = cv2.VideoCapture(self.source)
            if not cap.isOpened():
                logger.warning(f"[!] Failed opening {self.source}. Retrying in {backoff:.1f}s...")
                time.sleep(backoff)
                backoff = min(30.0, backoff * 1.5)
                continue

            backoff = 1.0  # Reset on successful connection
            while self._running and cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    logger.warning("[!] Stream disconnected or EOF. Reconnecting...")
                    break

                with self._lock:
                    self._frame = frame

                time.sleep(self.interval)

            cap.release()
            time.sleep(1.0)
