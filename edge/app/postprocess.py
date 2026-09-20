"""
Factory Safety AI - Postprocessing & Decision Engine
Implements:
1. Person-PPE Spatial Association (IoU & Anatomical Region Mapping)
2. Temporal Voting (2/5 Fire/Smoke, 8/10 PPE, 4/8 Smoking)
3. Zone Polygon Containment
4. Cooldown Deduplication
"""

import time
from collections import deque
from typing import List, Dict, Any, Tuple, Optional, Set
from pydantic import BaseModel

class Detection(BaseModel):
    class_id: int
    class_name: str
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2] normalized (0.0 to 1.0)
    track_id: Optional[int] = None

class PersonPPEStatus(BaseModel):
    person_bbox: List[float]
    track_id: Optional[int] = None
    has_helmet: bool = False
    has_bare_head: bool = False
    has_vest: bool = False
    has_gloves: bool = False
    has_no_gloves: bool = False
    has_boots: bool = False
    has_no_boots: bool = False
    missing_items: List[str] = []

def point_in_polygon(point: List[float], polygon: List[List[float]]) -> bool:
    """Ray-casting algorithm to test if [x, y] is inside polygon."""
    if len(polygon) < 3:
        return True  # If no polygon defined, treat as entire frame
    x, y = point
    inside = False
    n = len(polygon)
    p1x, p1y = polygon[0]
    for i in range(1, n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def box_center(bbox: List[float]) -> List[float]:
    """Returns [cx, cy] for [x1, y1, x2, y2]."""
    return [(bbox[0] + bbox[2]) / 2.0, (bbox[1] + bbox[3]) / 2.0]

def box_center_in_parent(child_box: List[float], parent_box: List[float]) -> bool:
    """Returns True if the center of child_box is inside parent_box."""
    cx, cy = box_center(child_box)
    return (parent_box[0] <= cx <= parent_box[2]) and (parent_box[1] <= cy <= parent_box[3])

def calculate_iou(boxA: List[float], boxB: List[float]) -> float:
    """Intersection over Union between two boxes [x1, y1, x2, y2]."""
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
    boxAArea = max(0.0, boxA[2] - boxA[0]) * max(0.0, boxA[3] - boxA[1])
    boxBArea = max(0.0, boxB[2] - boxB[0]) * max(0.0, boxB[3] - boxB[1])

    denom = boxAArea + boxBArea - interArea
    if denom <= 0:
        return 0.0
    return interArea / denom

def associate_person_ppe(detections: List[Detection], required_ppe: List[str]) -> List[PersonPPEStatus]:
    """
    Associates PPE detections with individual persons based on spatial containment.
    Identifies missing required PPE items.
    """
    persons = [d for d in detections if d.class_name == "person"]
    ppes = [d for d in detections if d.class_name != "person"]

    statuses: List[PersonPPEStatus] = []

    for p in persons:
        status = PersonPPEStatus(person_bbox=p.bbox, track_id=p.track_id)
        pb = p.bbox
        p_height = pb[3] - pb[1]

        # Anatomical sub-regions
        head_bottom = pb[1] + 0.35 * p_height
        torso_top = pb[1] + 0.15 * p_height
        torso_bottom = pb[1] + 0.70 * p_height
        feet_top = pb[1] + 0.65 * p_height

        for item in ppes:
            ib = item.bbox
            icx, icy = box_center(ib)

            # Check if inside person horizontal span
            if not (pb[0] - 0.05 <= icx <= pb[2] + 0.05):
                continue

            cname = item.class_name

            # Head region
            if icy <= head_bottom:
                if cname == "helmet":
                    status.has_helmet = True
                elif cname == "head":
                    status.has_bare_head = True

            # Torso region
            if torso_top <= icy <= torso_bottom:
                if cname == "vest":
                    status.has_vest = True

            # Hands / Limbs region
            if cname == "gloves":
                status.has_gloves = True
            elif cname == "no_gloves":
                status.has_no_gloves = True

            # Feet region
            if icy >= feet_top:
                if cname == "boots":
                    status.has_boots = True
                elif cname == "no_boots":
                    status.has_no_boots = True

        # Determine missing items based on zone requirements
        missing = []
        if "helmet" in required_ppe:
            if status.has_bare_head or not status.has_helmet:
                missing.append("helmet")

        if "vest" in required_ppe:
            if not status.has_vest:
                missing.append("vest")

        if "gloves" in required_ppe:
            if status.has_no_gloves or not status.has_gloves:
                missing.append("gloves")

        if "boots" in required_ppe:
            if status.has_no_boots or not status.has_boots:
                missing.append("boots")

        status.missing_items = missing
        statuses.append(status)

    return statuses

class TemporalVoter:
    """
    Temporal sliding-window voter to eliminate transient misclassifications.
    - Fire / Smoke: 2/5 positive frames (recall-first, low latency)
    - Smoking: 4/8 positive frames
    - Missing PPE: 8/10 positive frames (precision-first, zero nuisance alarms)
    """
    def __init__(self):
        self.windows: Dict[str, deque] = {}

    def vote(self, key: str, is_positive: bool, window_size: int, threshold: int) -> Tuple[bool, str]:
        """
        Record observation and check if threshold is satisfied.
        Returns: (is_triggered, votes_ratio_str e.g. "8/10")
        """
        if key not in self.windows:
            self.windows[key] = deque(maxlen=window_size)
        
        # Ensure maxlen matches in case dynamic
        if self.windows[key].maxlen != window_size:
            self.windows[key] = deque(self.windows[key], maxlen=window_size)

        self.windows[key].append(1 if is_positive else 0)
        positive_count = sum(self.windows[key])
        current_len = len(self.windows[key])
        votes_str = f"{positive_count}/{current_len}"

        is_triggered = (positive_count >= threshold) and (current_len >= min(3, threshold))
        return is_triggered, votes_str

    def reset(self, key: str):
        if key in self.windows:
            self.windows[key].clear()

class AlertCooldown:
    """
    Deduplicates and throttles alarms for ongoing violations.
    Suppresses alerts for the same event key within cooldown_sec.
    """
    def __init__(self, cooldown_seconds: float = 60.0):
        self.cooldown_seconds = cooldown_seconds
        self.last_fired: Dict[str, float] = {}

    def should_fire(self, alert_key: str) -> bool:
        now = time.time()
        last = self.last_fired.get(alert_key, 0.0)
        if now - last >= self.cooldown_seconds:
            self.last_fired[alert_key] = now
            return True
        return False

    def clear(self, alert_key: str):
        if alert_key in self.last_fired:
            del self.last_fired[alert_key]
