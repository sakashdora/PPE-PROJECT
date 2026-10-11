"""
Factory Safety AI - Person-Centric PPE Association Engine
Accurately maps detected PPE equipment (helmets, bare heads, vests, boots, gloves)
to individual workers based on anatomical containment, bipartite spatial matching,
and evidence-based compliance policies.
"""

from typing import List, Dict, Any, Optional, Tuple
import math
from app.postprocess import Detection, box_center, calculate_iou, check_torso_hivis


class WorkerPPEAssessment:
    """Unified per-person safety compliance assessment for a single frame."""
    def __init__(
        self,
        person_bbox: List[float],
        person_confidence: float,
        track_id: Optional[int] = None,
    ):
        self.person_bbox = [round(float(c), 4) for c in person_bbox]
        self.person_confidence = round(float(person_confidence), 3)
        self.track_id = track_id

        # Associated PPE components
        self.head_bbox: Optional[List[float]] = None
        self.head_confidence: float = 0.0
        self.has_head_detection: bool = False

        self.helmet_bbox: Optional[List[float]] = None
        self.helmet_confidence: float = 0.0
        self.has_helmet: bool = False

        self.vest_bbox: Optional[List[float]] = None
        self.vest_confidence: float = 0.0
        self.has_vest: bool = False

        self.boots_bbox: Optional[List[float]] = None
        self.boots_confidence: float = 0.0
        self.has_boots: bool = False
        self.boots_status: str = "UNKNOWN"

        self.gloves_bbox: Optional[List[float]] = None
        self.gloves_confidence: float = 0.0
        self.has_gloves: bool = False
        self.gloves_status: str = "UNKNOWN"

        # Status classifications: "COMPLIANT" | "VIOLATION" | "UNKNOWN"
        self.helmet_status: str = "UNKNOWN"
        self.vest_status: str = "UNKNOWN"
        self.safety_status: str = "UNKNOWN"

        self.missing_items: List[str] = []
        self.violations: List[str] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "track_id": self.track_id,
            "person_bbox": self.person_bbox,
            "person_confidence": self.person_confidence,
            "helmet_status": self.helmet_status,
            "helmet_confidence": self.helmet_confidence,
            "helmet_bbox": self.helmet_bbox,
            "vest_status": self.vest_status,
            "vest_confidence": self.vest_confidence,
            "vest_bbox": self.vest_bbox,
            "boots_status": self.boots_status,
            "boots_confidence": self.boots_confidence,
            "boots_bbox": self.boots_bbox,
            "gloves_status": self.gloves_status,
            "gloves_confidence": self.gloves_confidence,
            "gloves_bbox": self.gloves_bbox,
            "safety_status": self.safety_status,
            "missing_items": self.missing_items,
            "violations": self.violations,
        }


def _box_containment(child_box: List[float], parent_box: List[float]) -> float:
    """Calculates the fraction of child_box area contained within parent_box."""
    cx1, cy1, cx2, cy2 = child_box
    px1, py1, px2, py2 = parent_box

    ix1 = max(cx1, px1)
    iy1 = max(cy1, py1)
    ix2 = min(cx2, px2)
    iy2 = min(cy2, py2)

    inter_w = max(0.0, ix2 - ix1)
    inter_h = max(0.0, iy2 - iy1)
    inter_area = inter_w * inter_h

    child_area = max(1e-6, (cx2 - cx1) * (cy2 - cy1))
    return inter_area / child_area


def _anatomical_head_zone(person_bbox: List[float]) -> List[float]:
    """
    Returns the anatomical head region for a person [x1, y1, x2, y2].
    The head typically occupies the top ~35% of a standing or seated person,
    with horizontal margin for hardhat rims and side perspective.
    """
    x1, y1, x2, y2 = person_bbox
    w = max(1e-5, x2 - x1)
    h = max(1e-5, y2 - y1)

    hz_x1 = max(0.0, x1 - 0.12 * w)
    hz_x2 = min(1.0, x2 + 0.12 * w)
    hz_y1 = max(0.0, y1 - 0.10 * h)   # hardhat may protrude slightly above head/hair
    hz_y2 = min(1.0, y1 + 0.38 * h)

    return [hz_x1, hz_y1, hz_x2, hz_y2]


def _anatomical_torso_zone(person_bbox: List[float]) -> List[float]:
    """
    Returns the anatomical torso / vest region for a person.
    Covers from the shoulders/collarbone (top 18%) down to hips/thighs (75%),
    with tight lateral margin to prevent overlapping onto neighboring workers.
    """
    x1, y1, x2, y2 = person_bbox
    w = max(1e-5, x2 - x1)
    h = max(1e-5, y2 - y1)

    tz_x1 = max(0.0, x1 - 0.05 * w)
    tz_x2 = min(1.0, x2 + 0.05 * w)
    tz_y1 = max(0.0, y1 + 0.18 * h)   # Shoulders / collarbone
    tz_y2 = min(1.0, y1 + 0.75 * h)   # Waist / hips

    return [tz_x1, tz_y1, tz_x2, tz_y2]


def associate_person_ppe_v2(
    persons: List[Detection],
    ppe_items: List[Detection],
    required_ppe: Optional[List[str]] = None,
    frame: Optional[Any] = None,
) -> List[WorkerPPEAssessment]:
    """
    Person-centric detection and PPE association:
    1. Extracts anatomical sub-regions (head zone, torso zone).
    2. Performs global bipartite greedy matching so NO helmet/vest is assigned to multiple people.
    3. Resolves head vs helmet conflicts: Helmet detection PREVAILS over bare head.
    4. Evaluates evidence for missing PPE: Only confirmed bare head triggers violation.
       Occluded/low-confidence cases default to UNKNOWN.
    5. Validates high-visibility vest color on torso using frame verification.
    """
    if required_ppe is None:
        required_ppe = ["helmet", "vest"]

    assessments: List[WorkerPPEAssessment] = []
    if not persons:
        return assessments

    for p in persons:
        assessments.append(WorkerPPEAssessment(
            person_bbox=p.bbox,
            person_confidence=p.confidence,
            track_id=p.track_id,
        ))

    # Separate candidate detections
    helmets = [d for d in ppe_items if d.class_name == "helmet"]
    heads   = [d for d in ppe_items if d.class_name == "head"]
    vests   = [d for d in ppe_items if d.class_name == "vest"]
    boots   = [d for d in ppe_items if d.class_name in ("boots", "no_boots")]
    gloves  = [d for d in ppe_items if d.class_name in ("gloves", "no_gloves")]

    # -------------------------------------------------------------
    # 1. HELMET ASSOCIATION (Bipartite Greedy Matching)
    # -------------------------------------------------------------
    helmet_matches: List[Tuple[float, int, int]] = []  # (score, person_idx, helmet_idx)
    for p_idx, p in enumerate(assessments):
        head_zone = _anatomical_head_zone(p.person_bbox)
        pw = p.person_bbox[2] - p.person_bbox[0]
        pcx = (p.person_bbox[0] + p.person_bbox[2]) / 2.0

        for h_idx, h in enumerate(helmets):
            hcx, hcy = box_center(h.bbox)
            # Check center in head zone
            if (head_zone[0] <= hcx <= head_zone[2]) and (head_zone[1] <= hcy <= head_zone[3]):
                containment = _box_containment(h.bbox, head_zone)
                horiz_dist = abs(hcx - pcx) / max(pw, 1e-5)
                alignment_score = max(0.0, 1.0 - horiz_dist)
                score = (containment * 0.5) + (alignment_score * 0.3) + (h.confidence * 0.2)
                helmet_matches.append((score, p_idx, h_idx))

    # Sort matches by score descending
    helmet_matches.sort(key=lambda x: x[0], reverse=True)
    assigned_persons_helmet = set()
    assigned_helmets = set()

    for score, p_idx, h_idx in helmet_matches:
        if p_idx not in assigned_persons_helmet and h_idx not in assigned_helmets:
            assigned_persons_helmet.add(p_idx)
            assigned_helmets.add(h_idx)
            h = helmets[h_idx]
            assessments[p_idx].has_helmet = True
            assessments[p_idx].helmet_bbox = [round(float(c), 4) for c in h.bbox]
            assessments[p_idx].helmet_confidence = round(float(h.confidence), 3)

    # -------------------------------------------------------------
    # 2. HEAD (BARE HEAD) ASSOCIATION
    # -------------------------------------------------------------
    head_matches: List[Tuple[float, int, int]] = []
    for p_idx, p in enumerate(assessments):
        head_zone = _anatomical_head_zone(p.person_bbox)
        pw = p.person_bbox[2] - p.person_bbox[0]
        pcx = (p.person_bbox[0] + p.person_bbox[2]) / 2.0

        for hd_idx, hd in enumerate(heads):
            hdcx, hdcy = box_center(hd.bbox)
            if (head_zone[0] <= hdcx <= head_zone[2]) and (head_zone[1] <= hdcy <= head_zone[3]):
                containment = _box_containment(hd.bbox, head_zone)
                horiz_dist = abs(hdcx - pcx) / max(pw, 1e-5)
                alignment_score = max(0.0, 1.0 - horiz_dist)
                score = (containment * 0.5) + (alignment_score * 0.3) + (hd.confidence * 0.2)
                head_matches.append((score, p_idx, hd_idx))

    head_matches.sort(key=lambda x: x[0], reverse=True)
    assigned_persons_head = set()
    assigned_heads = set()

    for score, p_idx, hd_idx in head_matches:
        if p_idx not in assigned_persons_head and hd_idx not in assigned_heads:
            assigned_persons_head.add(p_idx)
            assigned_heads.add(hd_idx)
            hd = heads[hd_idx]
            assessments[p_idx].has_head_detection = True
            assessments[p_idx].head_bbox = [round(float(c), 4) for c in hd.bbox]
            assessments[p_idx].head_confidence = round(float(hd.confidence), 3)

    # -------------------------------------------------------------
    # 3. VEST ASSOCIATION
    # -------------------------------------------------------------
    vest_matches: List[Tuple[float, int, int]] = []
    for p_idx, p in enumerate(assessments):
        torso_zone = _anatomical_torso_zone(p.person_bbox)
        pw = max(1e-5, p.person_bbox[2] - p.person_bbox[0])
        ph = max(1e-5, p.person_bbox[3] - p.person_bbox[1])
        pcx = (p.person_bbox[0] + p.person_bbox[2]) / 2.0
        py1 = p.person_bbox[1]

        for v_idx, v in enumerate(vests):
            vcx, vcy = box_center(v.bbox)
            horiz_dist = abs(vcx - pcx) / pw
            # Vest center must be horizontally aligned with person (<= 38% of body width)
            if horiz_dist > 0.38:
                continue

            # Vest center must be vertically within torso bounds (18% to 75% of person height)
            rel_y = (vcy - py1) / ph
            if rel_y < 0.18 or rel_y > 0.75:
                continue

            # Must have substantial containment within person box or torso zone
            body_containment = _box_containment(v.bbox, p.person_bbox)
            torso_containment = _box_containment(v.bbox, torso_zone)
            containment = max(body_containment, torso_containment)

            if containment >= 0.35 or (torso_zone[0] <= vcx <= torso_zone[2] and torso_zone[1] <= vcy <= torso_zone[3]):
                alignment_score = max(0.0, 1.0 - horiz_dist)
                score = (containment * 0.45) + (alignment_score * 0.35) + (v.confidence * 0.20)
                vest_matches.append((score, p_idx, v_idx))

    vest_matches.sort(key=lambda x: x[0], reverse=True)
    assigned_persons_vest = set()
    assigned_vests = set()

    for score, p_idx, v_idx in vest_matches:
        if p_idx not in assigned_persons_vest and v_idx not in assigned_vests:
            v = vests[v_idx]
            if frame is not None:
                ratio, tight_box = check_torso_hivis(frame, assessments[p_idx].person_bbox)
                if ratio >= 0.05:
                    assigned_persons_vest.add(p_idx)
                    assigned_vests.add(v_idx)
                    assessments[p_idx].has_vest = True
                    assessments[p_idx].vest_bbox = tight_box or [round(float(c), 4) for c in v.bbox]
                    assessments[p_idx].vest_confidence = round(float(v.confidence), 3)
                else:
                    # Solid dark clothing falsely detected as vest is strictly rejected!
                    assessments[p_idx].has_vest = False
                    assessments[p_idx].vest_bbox = None
            else:
                assigned_persons_vest.add(p_idx)
                assigned_vests.add(v_idx)
                assessments[p_idx].has_vest = True
                assessments[p_idx].vest_bbox = [round(float(c), 4) for c in v.bbox]
                assessments[p_idx].vest_confidence = round(float(v.confidence), 3)

    # Torso photometric verification: if worker has no vest matched yet, but frame has hi-vis vest
    if frame is not None:
        for p_idx, a in enumerate(assessments):
            if not a.has_vest and p_idx not in assigned_persons_vest:
                ratio, tight_box = check_torso_hivis(frame, a.person_bbox)
                if ratio >= 0.05 and tight_box is not None:
                    a.has_vest = True
                    a.vest_bbox = tight_box
                    a.vest_confidence = 0.85

    # -------------------------------------------------------------
    # 4. BOOTS ASSOCIATION (Bipartite Greedy Matching)
    # -------------------------------------------------------------
    boots_matches: List[Tuple[float, int, int]] = []
    for p_idx, p in enumerate(assessments):
        pw = max(1e-5, p.person_bbox[2] - p.person_bbox[0])
        ph = max(1e-5, p.person_bbox[3] - p.person_bbox[1])
        pcx = (p.person_bbox[0] + p.person_bbox[2]) / 2.0
        py1 = p.person_bbox[1]

        for b_idx, b in enumerate(boots):
            bcx, bcy = box_center(b.bbox)
            horiz_dist = abs(bcx - pcx) / pw
            if horiz_dist > 0.45:
                continue
            rel_y = (bcy - py1) / ph
            # Feet must be in lower region (rel_y >= 0.55)
            if rel_y < 0.55:
                continue
            containment = _box_containment(b.bbox, p.person_bbox)
            alignment_score = max(0.0, 1.0 - horiz_dist)
            score = (containment * 0.4) + (alignment_score * 0.3) + (b.confidence * 0.3)
            boots_matches.append((score, p_idx, b_idx))

    boots_matches.sort(key=lambda x: x[0], reverse=True)
    assigned_persons_boots = set()
    assigned_boots = set()

    for score, p_idx, b_idx in boots_matches:
        if p_idx not in assigned_persons_boots and b_idx not in assigned_boots:
            assigned_persons_boots.add(p_idx)
            assigned_boots.add(b_idx)
            b = boots[b_idx]
            if b.class_name == "boots":
                assessments[p_idx].has_boots = True
                assessments[p_idx].boots_bbox = [round(float(c), 4) for c in b.bbox]
                assessments[p_idx].boots_confidence = round(float(b.confidence), 3)
                assessments[p_idx].boots_status = "COMPLIANT"
            elif b.class_name == "no_boots":
                assessments[p_idx].has_boots = False
                assessments[p_idx].boots_bbox = [round(float(c), 4) for c in b.bbox]
                assessments[p_idx].boots_confidence = round(float(b.confidence), 3)
                assessments[p_idx].boots_status = "VIOLATION"

    # -------------------------------------------------------------
    # 5. GLOVES ASSOCIATION (Bipartite Greedy Matching)
    # -------------------------------------------------------------
    gloves_matches: List[Tuple[float, int, int]] = []
    for p_idx, p in enumerate(assessments):
        pw = max(1e-5, p.person_bbox[2] - p.person_bbox[0])
        ph = max(1e-5, p.person_bbox[3] - p.person_bbox[1])
        pcx = (p.person_bbox[0] + p.person_bbox[2]) / 2.0
        py1 = p.person_bbox[1]

        for g_idx, g in enumerate(gloves):
            gcx, gcy = box_center(g.bbox)
            horiz_dist = abs(gcx - pcx) / pw
            if horiz_dist > 0.50:
                continue
            rel_y = (gcy - py1) / ph
            if rel_y < 0.20 or rel_y > 0.85:
                continue
            containment = _box_containment(g.bbox, p.person_bbox)
            alignment_score = max(0.0, 1.0 - horiz_dist)
            score = (containment * 0.4) + (alignment_score * 0.3) + (g.confidence * 0.3)
            gloves_matches.append((score, p_idx, g_idx))

    gloves_matches.sort(key=lambda x: x[0], reverse=True)
    assigned_persons_gloves = set()
    assigned_gloves = set()

    for score, p_idx, g_idx in gloves_matches:
        if p_idx not in assigned_persons_gloves and g_idx not in assigned_gloves:
            assigned_persons_gloves.add(p_idx)
            assigned_gloves.add(g_idx)
            g = gloves[g_idx]
            if g.class_name == "gloves":
                assessments[p_idx].has_gloves = True
                assessments[p_idx].gloves_bbox = [round(float(c), 4) for c in g.bbox]
                assessments[p_idx].gloves_confidence = round(float(g.confidence), 3)
                assessments[p_idx].gloves_status = "COMPLIANT"
            elif g.class_name == "no_gloves":
                assessments[p_idx].has_gloves = False
                assessments[p_idx].gloves_bbox = [round(float(c), 4) for c in g.bbox]
                assessments[p_idx].gloves_confidence = round(float(g.confidence), 3)
                assessments[p_idx].gloves_status = "VIOLATION"

    # -------------------------------------------------------------
    # 6. COMPLIANCE DECISION POLICY
    # -------------------------------------------------------------
    for a in assessments:
        pb = a.person_bbox
        ph = pb[3] - pb[1]

        # 4.1 HELMET STATUS:
        # Rule A: If a helmet is associated with this worker, they are COMPLIANT.
        # (Helmet presence strictly overrides any overlapping bare head/face detections!)
        if a.has_helmet:
            a.helmet_status = "COMPLIANT"
            a.has_head_detection = False
        # Rule B: If no helmet is found, but a clear bare head detection exists with confident threshold:
        elif a.has_head_detection and a.head_confidence >= 0.45:
            a.helmet_status = "VIOLATION"
            a.missing_items.append("helmet")
            a.violations.append("NO_HELMET")
        # Rule C: Neither helmet nor bare head detected (occluded worker, back turned, distant):
        else:
            a.helmet_status = "UNKNOWN"

        # 4.2 VEST STATUS:
        if a.has_vest:
            a.vest_status = "COMPLIANT"
        else:
            # Only classify missing vest as violation when upper body is confirmed and worker is close enough (ph >= 0.22)
            if (a.has_helmet or a.has_head_detection) and "vest" in required_ppe and ph >= 0.22:
                a.vest_status = "VIOLATION"
                a.missing_items.append("vest")
                a.violations.append("NO_VEST")
            else:
                # Distant worker, thermal coat, or upper body not resolvable
                a.vest_status = "UNKNOWN"

        # 4.3 OVERALL SAFETY STATUS:
        if a.helmet_status == "VIOLATION" or a.vest_status == "VIOLATION":
            a.safety_status = "VIOLATION"
        elif a.helmet_status == "COMPLIANT" and (a.vest_status == "COMPLIANT" or "vest" not in required_ppe):
            a.safety_status = "COMPLIANT"
        else:
            a.safety_status = "UNKNOWN"

    return assessments
