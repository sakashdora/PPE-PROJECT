"""
Factory Safety AI - Low-Latency MJPEG Streaming Server
Serves real-time annotated video frames (zones, bboxes, alerts) over HTTP multipart stream.
Embedded directly into the Next.js Video Wall via standard <img> or canvas tags.
"""

import time
import logging
import threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from typing import Dict, Optional
import numpy as np

logger = logging.getLogger("edge.mjpeg")

class FrameHub:
    """Thread-safe storage for latest annotated frames per camera."""
    def __init__(self):
        self._frames: Dict[str, bytes] = {}
        self._lock = threading.Lock()

    def update_frame(self, camera_id: str, frame_bgr: np.ndarray) -> None:
        import cv2
        ret, jpeg = cv2.imencode(".jpg", frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if ret:
            with self._lock:
                self._frames[camera_id] = jpeg.tobytes()

    def get_frame(self, camera_id: str) -> Optional[bytes]:
        with self._lock:
            return self._frames.get(camera_id)

frame_hub = FrameHub()

class MJPEGHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress routine GET logs to prevent terminal spam
        pass

    def handle(self):
        try:
            super().handle()
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass

    def do_GET(self):
        if self.path.startswith("/stream/"):
            camera_id = self.path.split("/stream/")[1].split("?")[0]
            if frame_hub.get_frame(camera_id) is None:
                self.send_response(503)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Cache-Control", "no-cache, private")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            while True:
                jpeg_bytes = frame_hub.get_frame(camera_id)
                if jpeg_bytes is not None:
                    try:
                        self.wfile.write(b"--frame\r\n")
                        self.send_header("Content-Type", "image/jpeg")
                        self.send_header("Content-Length", str(len(jpeg_bytes)))
                        self.end_headers()
                        self.wfile.write(jpeg_bytes)
                        self.wfile.write(b"\r\n")
                    except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
                        break
                time.sleep(0.08)  # ~12 fps for web preview

        elif self.path.startswith("/snapshot/"):
            camera_id = self.path.split("/snapshot/")[1].split("?")[0]
            jpeg_bytes = frame_hub.get_frame(camera_id)
            if jpeg_bytes:
                self.send_response(200)
                self.send_header("Content-Type", "image/jpeg")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(jpeg_bytes)
            else:
                self.send_response(404)
                self.end_headers()

        elif self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b"OK")
        else:
            self.send_response(404)
            self.end_headers()

class QuietThreadingHTTPServer(ThreadingHTTPServer):
    """ThreadingHTTPServer that suppresses harmless socket disconnect tracebacks."""
    def handle_error(self, request, client_address):
        import sys
        exc_type, _, _ = sys.exc_info()
        if exc_type in (ConnectionResetError, BrokenPipeError, ConnectionAbortedError):
            logger.debug(f"Client disconnected: {client_address}")
            return
        super().handle_error(request, client_address)

def start_mjpeg_server(port: int = 8080) -> QuietThreadingHTTPServer:
    """Launches MJPEG HTTP streaming server in background daemon thread."""
    server = QuietThreadingHTTPServer(("0.0.0.0", port), MJPEGHandler)
    server.daemon_threads = True
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    logger.info(f"[*] MJPEG Video Wall streaming server active on port {port}")
    return server
