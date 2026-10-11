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
                    else:
                        xinters = p1x
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
            if pb[1] <= icy <= head_bottom:
                if cname == "helmet":
                    status.has_helmet = True
                elif cname == "head":
                    status.has_bare_head = True

            # Torso region
            if torso_top <= icy <= torso_bottom:
                if cname == "vest":
                    status.has_vest = True

            # Hands / Limbs region
            if cname == "gloves" and pb[1] <= icy <= pb[3]:
                status.has_gloves = True
            elif cname == "no_gloves" and pb[1] <= icy <= pb[3]:
                status.has_no_gloves = True

            # Feet region
            if feet_top <= icy <= pb[3]:
                if cname == "boots":
                    status.has_boots = True
                elif cname == "no_boots":
                    status.has_no_boots = True

        # If helmet is detected on person, helmet takes precedence over overlapping head/face detection
        if status.has_helmet:
            status.has_bare_head = False

        # Determine missing items based on zone requirements
        missing = []
        if "helmet" in required_ppe:
            if not status.has_helmet:
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

def check_torso_hivis(frame: Any, person_bbox: List[float]) -> Tuple[float, Optional[List[float]]]:
    """
    Validates whether a worker's anatomical torso region contains genuine
    high-visibility fluorescent safety colors (EN ISO 20471 standard: fluorescent lime/yellow, fluorescent safety orange).
    Returns (hivis_ratio, tight_vest_bbox).
    """
    if frame is None or not hasattr(frame, "shape"):
        return 1.0, None

    try:
        import cv2
        import numpy as np

        h, w = frame.shape[:2]
        px1, py1, px2, py2 = person_bbox
        pw = max(1e-5, px2 - px1)
        ph = max(1e-5, py2 - py1)

        # Torso search region: central 70% of person width (15% margin on each side to prevent background netting bleed)
        # Vertical range: shoulders (18% of height) to mid-torso/waist (54% of height)
        tx1 = int(max(0.0, px1 + 0.15 * pw) * w)
        tx2 = int(min(1.0, px2 - 0.15 * pw) * w)
        ty1 = int(max(0.0, py1 + 0.18 * ph) * h)
        ty2 = int(min(1.0, py1 + 0.54 * ph) * h)

        if tx2 <= tx1 or ty2 <= ty1:
            return 0.0, None

        crop = frame[ty1:ty2, tx1:tx2]
        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)

        # Fluorescent high-vis lime / yellow-green (EN ISO 20471: H in [32, 62], S >= 55, V >= 155)
        m_lime = cv2.inRange(hsv, np.array([32, 55, 155]), np.array([62, 255, 255]))
        # Fluorescent high-vis safety orange / red-orange (H in [5, 20], S >= 80, V >= 140)
        m_orange = cv2.inRange(hsv, np.array([5, 80, 140]), np.array([20, 255, 255]))

        # High-visibility safety vests strictly require fluorescent base fabric
        combined = m_lime | m_orange
        total_pixels = crop.shape[0] * crop.shape[1]
        if total_pixels <= 0:
            return 0.0, None

        ratio = float(np.count_nonzero(combined) / total_pixels)
        vest_box = None
        if ratio >= 0.05:
            vest_box = [
                round(float(tx1) / w, 4),
                round(float(ty1) / h, 4),
                round(float(tx2) / w, 4),
                round(float(ty2) / h, 4),
            ]

        return ratio, vest_box
    except Exception:
        return 1.0, None


def filter_and_validate_detections(detections: List[Detection], frame: Optional[Any] = None) -> List[Detection]:
    """
    Anatomical Spatial Validation Engine:
    1. Person-PPE grounding: Anchors footwear, headwear, vest, and gloves to human body geometry.
    2. Suppresses false footwear ('boots', 'no_boots') appearing on hands, waist, or head:
       - Footwear must lie in the bottom feet region of a person (rel_y >= 0.58).
       - If footwear is detected at head height (rel_y <= 0.35), it is reclassified as 'helmet' if missing, or suppressed.
       - If footwear is detected on limbs/waist (0.35 < rel_y < 0.58), it is suppressed.
    3. Headwear positioning:
       - 'helmet' and 'head' must be in upper 42% of person (rel_y <= 0.42). Lower detections are suppressed.
    4. Torso Vest Validation:
       - Detections at head height (rel_y <= 0.20) are reclassified as 'helmet'.
       - Detections in torso region (0.18 < rel_y <= 0.78) are verified for genuine hi-vis color.
    5. Overlap resolution:
       - Conflicting overlaps (e.g. 'no_boots' overlapping with 'helmet' with IoU > 0.20) drop the false 'no_boots'.
    """
    if not detections:
        return []

    # 0. Suppress duplicate overlapping person detections (IoU > 0.40) to prevent double counting
    raw_persons = [d for d in detections if d.class_name == "person"]
    persons: List[Detection] = []
    for p in sorted(raw_persons, key=lambda x: x.confidence, reverse=True):
        if not any(calculate_iou(p.bbox, kp.bbox) > 0.40 for kp in persons):
            persons.append(p)

    hazards = [d for d in detections if d.class_name in ("fire", "smoke", "cigarette")]

    # If NO PERSON is detected in the frame, NO PPE items can exist.
    if not persons:
        return hazards

    ppe_items = [d for d in detections if d.class_name not in ("person", "fire", "smoke", "cigarette")]
    validated_ppe: List[Detection] = []

    for item in ppe_items:
        icx, icy = box_center(item.bbox)
        cname = item.class_name

        # Find candidate matching person whose horizontal and vertical extent encompasses item
        candidate_person = None
        best_match_score = -1.0

        for p in persons:
            pb = p.bbox
            pw = max(pb[2] - pb[0], 1e-5)
            ph = max(pb[3] - pb[1], 1e-5)

            # Horizontal span test (with 12% margin)
            if (pb[0] - 0.12 * pw) <= icx <= (pb[2] + 0.12 * pw):
                # Vertical span test (with 10% margin above head, 5% below feet)
                if (pb[1] - 0.10 * ph) <= icy <= (pb[3] + 0.05 * ph):
                    score = 1.0 - abs(icx - (pb[0] + pb[2]) / 2.0) / pw
                    if score > best_match_score:
                        best_match_score = score
                        candidate_person = p

        if candidate_person is not None:
            pb = candidate_person.bbox
            pw = max(pb[2] - pb[0], 1e-5)
            ph = max(pb[3] - pb[1], 1e-5)
            rel_y = (icy - pb[1]) / ph

            # 1. Footwear validation ('boots', 'no_boots')
            if cname in ("boots", "no_boots"):
                if rel_y >= 0.58:
                    # Valid feet region!
                    validated_ppe.append(item)
                elif rel_y <= 0.35:
                    # Object at head level detected as footwear (e.g. hardhat misclassified)
                    head_has_helmet = any(
                        d.class_name == "helmet" and
                        (pb[0] - 0.10 * pw <= box_center(d.bbox)[0] <= pb[2] + 0.10 * pw) and
                        ((box_center(d.bbox)[1] - pb[1]) / ph <= 0.35)
                        for d in ppe_items if d is not item
                    )
                    if not head_has_helmet and item.confidence >= 0.35:
                        validated_ppe.append(Detection(
                            class_id=1,
                            class_name="helmet",
                            confidence=item.confidence,
                            bbox=item.bbox,
                            track_id=item.track_id
                        ))
                else:
                    continue

            # 2. Headwear validation ('helmet', 'head')
            elif cname in ("helmet", "head"):
                if rel_y <= 0.42:
                    validated_ppe.append(item)

            # 3. Torso validation ('vest')
            elif cname == "vest":
                if rel_y <= 0.20:
                    # Object at head level detected as vest -> Reclassify to helmet!
                    head_has_helmet = any(
                        d.class_name == "helmet" and
                        (pb[0] - 0.10 * pw <= box_center(d.bbox)[0] <= pb[2] + 0.10 * pw) and
                        ((box_center(d.bbox)[1] - pb[1]) / ph <= 0.35)
                        for d in validated_ppe
                    )
                    if not head_has_helmet:
                        validated_ppe.append(Detection(
                            class_id=1,
                            class_name="helmet",
                            confidence=item.confidence,
                            bbox=item.bbox,
                            track_id=item.track_id
                        ))
                elif 0.20 < rel_y <= 0.78:
                    if frame is not None:
                        hivis_ratio, _ = check_torso_hivis(frame, pb)
                        if hivis_ratio >= 0.05:
                            validated_ppe.append(item)
                        # else: Solid dark non-hi-vis clothing falsely predicted as vest is suppressed!
                    else:
                        validated_ppe.append(item)

            # 4. Gloves validation ('gloves', 'no_gloves')
            elif cname in ("gloves", "no_gloves"):
                if rel_y >= 0.22:
                    validated_ppe.append(item)
            else:
                validated_ppe.append(item)

        # Unanchored PPE items (no person containing them) are intentionally suppressed to prevent false alarms

    # Secondary Non-Maximum Suppression across conflicting classes:
    final_items: List[Detection] = []
    for item in validated_ppe:
        if item.class_name == "no_boots":
            conflicts = any(
                other.class_name in ("helmet", "head") and calculate_iou(item.bbox, other.bbox) > 0.20
                for other in validated_ppe if other is not item
            )
            if conflicts:
                continue
        elif item.class_name == "head":
            # If a helmet is detected in the head region, suppress bare-head detection (face under hardhat)
            conflicts_helmet = any(
                other.class_name == "helmet" and (
                    calculate_iou(item.bbox, other.bbox) > 0.05 or
                    abs(box_center(item.bbox)[0] - box_center(other.bbox)[0]) < 0.14
                )
                for other in validated_ppe if other is not item
            )
            if conflicts_helmet:
                continue
        final_items.append(item)

    return persons + hazards + final_items

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
