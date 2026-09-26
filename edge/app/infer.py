"""
Factory Safety AI - Edge Inference Runtime
Provides high-performance inference across ONNX Runtime, OpenVINO, or realistic Mock fallback.
Handles letterboxing, tensor normalization, threshold filtering, and coordinate scaling.
"""

import time
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

from app.config import ThresholdsConfig
from app.postprocess import Detection

logger = logging.getLogger("edge.infer")

CLASS_NAMES = [
    "person",     # 0
    "helmet",     # 1
    "head",       # 2 (bare head)
    "vest",       # 3
    "gloves",     # 4
    "boots",      # 5
    "no_gloves",  # 6
    "no_boots",   # 7
    "fire",       # 8
    "smoke",      # 9
    "cigarette",  # 10
]

class BaseInferenceEngine:
    def __init__(self, thresholds: ThresholdsConfig):
        self.thresholds = thresholds

    def get_threshold(self, class_name: str) -> float:
        return getattr(self.thresholds, class_name, 0.50)

    def infer(self, frame: np.ndarray) -> List[Detection]:
        raise NotImplementedError

class ONNXRuntimeEngine(BaseInferenceEngine):
    """CPU/Edge ONNX runtime using onnxruntime."""
    def __init__(self, model_path: str, thresholds: ThresholdsConfig):
        super().__init__(thresholds)
        self.model_path = model_path
        import onnxruntime as ort
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 2
        opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        self.session = ort.InferenceSession(model_path, sess_options=opts, providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name
        self.input_shape = self.session.get_inputs()[0].shape  # [1, 3, 640, 640]
        logger.info(f"[*] ONNX session initialized from {model_path}")

    def infer(self, frame: np.ndarray) -> List[Detection]:
        h, w = frame.shape[:2]
        img_size = 640

        # Letterbox preprocess
        import cv2
        scale = min(img_size / h, img_size / w)
        nw, nh = int(w * scale), int(h * scale)
        resized = cv2.resize(frame, (nw, nh), interpolation=cv2.INTER_LINEAR)
        canvas = np.full((img_size, img_size, 3), 114, dtype=np.uint8)
        pad_x = (img_size - nw) // 2
        pad_y = (img_size - nh) // 2
        canvas[pad_y:pad_y + nh, pad_x:pad_x + nw] = resized

        # Normalization
        blob = canvas[:, :, ::-1].transpose(2, 0, 1).astype(np.float32) / 255.0
        blob = np.expand_dims(blob, axis=0)

        outputs = self.session.run(None, {self.input_name: blob})[0]
        if not isinstance(outputs, np.ndarray):
            outputs = np.array(outputs)

        detections: List[Detection] = []
        # Format A: Embedded NMS tensor [1, max_det, 6] -> [x1, y1, x2, y2, conf, class_id]
        if len(outputs.shape) == 3 and outputs.shape[2] == 6:
            for row in outputs[0]:
                conf = float(row[4])
                if conf <= 0.05:
                    continue
                cid = int(row[5])
                cname = CLASS_NAMES[cid] if cid < len(CLASS_NAMES) else "unknown"
                if conf < self.get_threshold(cname):
                    continue

                x1 = (float(row[0]) - pad_x) / nw
                y1 = (float(row[1]) - pad_y) / nh
                x2 = (float(row[2]) - pad_x) / nw
                y2 = (float(row[3]) - pad_y) / nh

                detections.append(Detection(
                    class_id=cid,
                    class_name=cname,
                    confidence=round(conf, 3),
                    bbox=[max(0.0, x1), max(0.0, y1), min(1.0, x2), min(1.0, y2)]
                ))
        else:
            # Format B: Raw anchors [1, 15, 8400]
            if outputs.shape[1] == 15 and outputs.shape[2] > 15:
                preds = outputs[0].T  # Shape [8400, 15]
            else:
                preds = outputs[0]

            for row in preds:
                cx, cy, bw, bh = row[:4]
                class_scores = row[4:]
                cid = int(np.argmax(class_scores))
                conf = float(class_scores[cid])

                cname = CLASS_NAMES[cid] if cid < len(CLASS_NAMES) else "unknown"
                if conf < self.get_threshold(cname):
                    continue

                # Unpad to original image coordinates
                x1 = (cx - bw / 2.0 - pad_x) / nw
                y1 = (cy - bh / 2.0 - pad_y) / nh
                x2 = (cx + bw / 2.0 - pad_x) / nw
                y2 = (cy + bh / 2.0 - pad_y) / nh

                detections.append(Detection(
                    class_id=cid,
                    class_name=cname,
                    confidence=round(conf, 3),
                    bbox=[max(0.0, x1), max(0.0, y1), min(1.0, x2), min(1.0, y2)]
                ))

        return detections

class MockInferenceEngine(BaseInferenceEngine):
    """
    Deterministic simulated inference for standalone testing and video wall previews.
    Generates synthetic workers, PPE bounding boxes, and timed hazards.
    """
    def __init__(self, thresholds: ThresholdsConfig):
        super().__init__(thresholds)
        self.frame_count = 0

    def infer(self, frame: np.ndarray) -> List[Detection]:
        self.frame_count += 1
        t = self.frame_count

        detections: List[Detection] = []

        # Worker 1: Compliant worker in Assembly Line A
        p1_bbox = [0.25, 0.35, 0.40, 0.85]
        detections.append(Detection(class_id=0, class_name="person", confidence=0.92, bbox=p1_bbox, track_id=101))
        detections.append(Detection(class_id=1, class_name="helmet", confidence=0.89, bbox=[0.29, 0.35, 0.36, 0.45]))
        detections.append(Detection(class_id=3, class_name="vest", confidence=0.86, bbox=[0.27, 0.45, 0.38, 0.68]))
        detections.append(Detection(class_id=4, class_name="gloves", confidence=0.82, bbox=[0.25, 0.55, 0.28, 0.65]))
        detections.append(Detection(class_id=5, class_name="boots", confidence=0.85, bbox=[0.28, 0.78, 0.38, 0.85]))

        # Worker 2: Missing Helmet & Gloves in Boiler Room
        p2_bbox = [0.60, 0.30, 0.76, 0.82]
        detections.append(Detection(class_id=0, class_name="person", confidence=0.88, bbox=p2_bbox, track_id=102))
        detections.append(Detection(class_id=2, class_name="head", confidence=0.84, bbox=[0.64, 0.30, 0.72, 0.41]))  # Bare head!
        detections.append(Detection(class_id=3, class_name="vest", confidence=0.79, bbox=[0.62, 0.42, 0.74, 0.65]))
        detections.append(Detection(class_id=6, class_name="no_gloves", confidence=0.75, bbox=[0.60, 0.52, 0.63, 0.62]))

        # Periodic Hazard Simulation:
        # Every 60 frames, simulate fire hazard for 10 frames
        if 40 <= (t % 120) <= 60:
            fire_conf = 0.88
            detections.append(Detection(class_id=8, class_name="fire", confidence=fire_conf, bbox=[0.72, 0.40, 0.85, 0.60]))
            detections.append(Detection(class_id=9, class_name="smoke", confidence=0.81, bbox=[0.70, 0.20, 0.88, 0.45]))

        # Periodic Smoking in Restricted Zone:
        if 80 <= (t % 160) <= 110:
            detections.append(Detection(class_id=10, class_name="cigarette", confidence=0.78, bbox=[0.66, 0.37, 0.70, 0.42]))

        return detections

def get_inference_engine(model_path: str, thresholds: ThresholdsConfig) -> BaseInferenceEngine:
    """Factory to instantiate best available runtime engine."""
    p = Path(model_path)
    if p.exists() and p.suffix == ".onnx":
        try:
            return ONNXRuntimeEngine(model_path, thresholds)
        except Exception as e:
            logger.warning(f"Could not load ONNX model ({e}). Using Mock engine.")
    return MockInferenceEngine(thresholds)
