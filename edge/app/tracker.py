"""
Factory Safety AI - Multi-Person Worker Tracking Engine
Provides stable track IDs, track lifecycle management, spatial IoU association,
and temporal PPE compliance stabilization (hysteresis) across video frames.
"""

from typing import List, Dict, Any, Optional, Tuple
from collections import deque
import uuid

from app.postprocess import calculate_iou
from app.association import WorkerPPEAssessment


class SafetyEvent:
    """Debounced safety violation event associated with a specific worker track."""
    def __init__(
        self,
        event_id: str,
        track_id: int,
        event_type: str,
        severity: str,
        start_ts: float,
        start_frame: int,
        description: str,
        confidence: float,
        snapshot_b64: Optional[str] = None,
    ):
        self.event_id = event_id
        self.track_id = track_id
        self.event_type = event_type
        self.severity = severity
        self.start_ts = round(float(start_ts), 2)
        self.end_ts = round(float(start_ts), 2)
        self.start_frame = start_frame
        self.end_frame = start_frame
        self.description = description
        self.confidence = round(float(confidence), 3)
        self.snapshot_b64 = snapshot_b64
        self.status = "ACTIVE"  # "ACTIVE" | "RESOLVED"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "track_id": self.track_id,
            "event_type": self.event_type,
            "severity": self.severity,
            "start_ts": self.start_ts,
            "end_ts": self.end_ts,
            "duration_sec": round(self.end_ts - self.start_ts, 2),
            "start_frame": self.start_frame,
            "end_frame": self.end_frame,
            "description": self.description,
            "confidence": self.confidence,
            "status": self.status,
            "snapshot": self.snapshot_b64,
        }


class WorkerTrack:
    """Maintains state, spatial trajectory, and PPE compliance history for a tracked worker."""
    def __init__(self, track_id: int, initial_assessment: WorkerPPEAssessment, frame_idx: int, ts: float):
        self.track_id = track_id
        self.bbox = list(initial_assessment.person_bbox)
        self.confidence = initial_assessment.person_confidence
        self.hits = 1
        self.age = 1
        self.time_since_update = 0
        self.state = "ACTIVE"  # "ACTIVE" | "LOST" | "COMPLETED"

        self.first_seen_ts = round(float(ts), 2)
        self.last_seen_ts = round(float(ts), 2)
        self.first_seen_frame = frame_idx
        self.last_seen_frame = frame_idx

        # Rolling history of per-frame observations (maxlen=15)
        self.helmet_history: deque = deque(maxlen=15)
        self.vest_history: deque = deque(maxlen=15)
        self.boots_history: deque = deque(maxlen=15)
        self.gloves_history: deque = deque(maxlen=15)
        self.helmet_history.append(initial_assessment.helmet_status)
        self.vest_history.append(initial_assessment.vest_status)
        self.boots_history.append(getattr(initial_assessment, "boots_status", "UNKNOWN"))
        self.gloves_history.append(getattr(initial_assessment, "gloves_status", "UNKNOWN"))

        # Stabilized statuses
        self.helmet_status = initial_assessment.helmet_status
        self.vest_status = initial_assessment.vest_status
        self.boots_status = getattr(initial_assessment, "boots_status", "UNKNOWN")
        self.gloves_status = getattr(initial_assessment, "gloves_status", "UNKNOWN")
        self.safety_status = initial_assessment.safety_status

        # Localized component bounding boxes
        self.helmet_bbox: Optional[List[float]] = initial_assessment.helmet_bbox
        self.vest_bbox: Optional[List[float]] = initial_assessment.vest_bbox
        self.boots_bbox: Optional[List[float]] = getattr(initial_assessment, "boots_bbox", None)
        self.gloves_bbox: Optional[List[float]] = getattr(initial_assessment, "gloves_bbox", None)

        self.latest_assessment: WorkerPPEAssessment = initial_assessment
        initial_assessment.track_id = track_id

        # Continuous violation tracking
        self.active_violations: Dict[str, SafetyEvent] = {}
        self.all_recorded_events: List[SafetyEvent] = []

    def update(self, assessment: WorkerPPEAssessment, frame_idx: int, ts: float, snapshot_b64: Optional[str] = None):
        self.hits += 1
        self.age += 1
        self.time_since_update = 0
        self.state = "ACTIVE"
        self.last_seen_ts = round(float(ts), 2)
        self.last_seen_frame = frame_idx
        self.confidence = assessment.person_confidence

        # Exponential moving average smooth bounding box update (alpha=0.7)
        alpha = 0.70
        self.bbox = [
            round(alpha * nb + (1.0 - alpha) * ob, 4)
            for nb, ob in zip(assessment.person_bbox, self.bbox)
        ]

        # Record observations
        self.helmet_history.append(assessment.helmet_status)
        self.vest_history.append(assessment.vest_status)
        self.boots_history.append(getattr(assessment, "boots_status", "UNKNOWN"))
        self.gloves_history.append(getattr(assessment, "gloves_status", "UNKNOWN"))

        # Temporal stabilization / hysteresis
        self._stabilize_compliance(frame_idx, ts, snapshot_b64)

        # Update localized PPE component boxes
        if assessment.helmet_bbox:
            self.helmet_bbox = assessment.helmet_bbox
        if assessment.vest_bbox and self.vest_status == "COMPLIANT":
            self.vest_bbox = assessment.vest_bbox
        elif self.vest_status == "VIOLATION":
            self.vest_bbox = None

        if getattr(assessment, "boots_bbox", None):
            self.boots_bbox = assessment.boots_bbox
        if getattr(assessment, "gloves_bbox", None):
            self.gloves_bbox = assessment.gloves_bbox

        # Link track ID back into assessment
        assessment.track_id = self.track_id
        assessment.helmet_status = self.helmet_status
        assessment.vest_status = self.vest_status
        assessment.boots_status = self.boots_status
        assessment.gloves_status = self.gloves_status
        assessment.safety_status = self.safety_status
        self.latest_assessment = assessment

    def mark_missed(self, frame_idx: int, ts: float, max_lost: int):
        self.age += 1
        self.time_since_update += 1
        if self.time_since_update > max_lost:
            self.state = "COMPLETED"
            # Close any active violations
            for event in self.active_violations.values():
                event.status = "RESOLVED"
                event.end_ts = self.last_seen_ts
                event.end_frame = self.last_seen_frame
            self.active_violations.clear()
        else:
            self.state = "LOST"

    def _stabilize_compliance(self, frame_idx: int, ts: float, snapshot_b64: Optional[str] = None):
        """
        Evidence-based temporal hysteresis:
        - Avoids flipping worker status on a single noisy or blurred frame.
        - Requires sustained evidence (at least 2 of last 6 frames) to trigger or resolve violation.
        """
        recent_helmets = list(self.helmet_history)[-6:]
        comp_h_votes = recent_helmets.count("COMPLIANT")
        viol_h_votes = recent_helmets.count("VIOLATION")

        # 1. Helmet stabilization:
        if comp_h_votes >= 2 and comp_h_votes >= viol_h_votes:
            self.helmet_status = "COMPLIANT"
            # Resolve helmet violation if active
            if "NO_HELMET" in self.active_violations:
                ev = self.active_violations.pop("NO_HELMET")
                ev.status = "RESOLVED"
                ev.end_ts = round(float(ts), 2)
                ev.end_frame = frame_idx
        elif viol_h_votes >= 2 and viol_h_votes > comp_h_votes:
            self.helmet_status = "VIOLATION"
            # Maintain or start continuous violation event
            if "NO_HELMET" not in self.active_violations:
                new_ev = SafetyEvent(
                    event_id=f"evt-{uuid.uuid4().hex[:8]}",
                    track_id=self.track_id,
                    event_type="NO_HELMET",
                    severity="WARNING",
                    start_ts=ts,
                    start_frame=frame_idx,
                    description=f"Worker #{self.track_id:03d} missing safety helmet",
                    confidence=self.latest_assessment.head_confidence or 0.85,
                    snapshot_b64=snapshot_b64,
                )
                self.active_violations["NO_HELMET"] = new_ev
                self.all_recorded_events.append(new_ev)
            else:
                self.active_violations["NO_HELMET"].end_ts = round(float(ts), 2)
                self.active_violations["NO_HELMET"].end_frame = frame_idx
        elif self.helmet_status == "UNKNOWN":
            if recent_helmets.count("UNKNOWN") >= 3:
                self.helmet_status = "UNKNOWN"

        # 2. Vest stabilization:
        recent_vests = list(self.vest_history)[-6:]
        comp_v_votes = recent_vests.count("COMPLIANT")
        viol_v_votes = recent_vests.count("VIOLATION")

        if comp_v_votes >= 2 and comp_v_votes >= viol_v_votes:
            self.vest_status = "COMPLIANT"
            # Resolve vest violation if active
            if "NO_VEST" in self.active_violations:
                ev = self.active_violations.pop("NO_VEST")
                ev.status = "RESOLVED"
                ev.end_ts = round(float(ts), 2)
                ev.end_frame = frame_idx
        elif viol_v_votes >= 2 and viol_v_votes > comp_v_votes:
            self.vest_status = "VIOLATION"
            # Maintain or start continuous violation event
            if "NO_VEST" not in self.active_violations:
                new_ev = SafetyEvent(
                    event_id=f"evt-{uuid.uuid4().hex[:8]}",
                    track_id=self.track_id,
                    event_type="NO_VEST",
                    severity="WARNING",
                    start_ts=ts,
                    start_frame=frame_idx,
                    description=f"Worker #{self.track_id:03d} missing hi-vis safety vest",
                    confidence=0.85,
                    snapshot_b64=snapshot_b64,
                )
                self.active_violations["NO_VEST"] = new_ev
                self.all_recorded_events.append(new_ev)
            else:
                self.active_violations["NO_VEST"].end_ts = round(float(ts), 2)
                self.active_violations["NO_VEST"].end_frame = frame_idx
        else:
            self.vest_status = "UNKNOWN"

        # 3. Boots stabilization:
        recent_boots = list(self.boots_history)[-6:]
        comp_b_votes = recent_boots.count("COMPLIANT")
        viol_b_votes = recent_boots.count("VIOLATION")

        if comp_b_votes >= 2:
            self.boots_status = "COMPLIANT"
            if "NO_BOOTS" in self.active_violations:
                ev = self.active_violations.pop("NO_BOOTS")
                ev.status = "RESOLVED"
                ev.end_ts = round(float(ts), 2)
                ev.end_frame = frame_idx
        elif viol_b_votes >= 2:
            self.boots_status = "VIOLATION"
            if "NO_BOOTS" not in self.active_violations:
                new_ev = SafetyEvent(
                    event_id=f"evt-{uuid.uuid4().hex[:8]}",
                    track_id=self.track_id,
                    event_type="NO_BOOTS",
                    severity="WARNING",
                    start_ts=ts,
                    start_frame=frame_idx,
                    description=f"Worker #{self.track_id:03d} missing safety boots",
                    confidence=0.85,
                    snapshot_b64=snapshot_b64,
                )
                self.active_violations["NO_BOOTS"] = new_ev
                self.all_recorded_events.append(new_ev)
            else:
                self.active_violations["NO_BOOTS"].end_ts = round(float(ts), 2)
                self.active_violations["NO_BOOTS"].end_frame = frame_idx
        else:
            self.boots_status = "UNKNOWN"

        # 4. Gloves stabilization:
        recent_gloves = list(self.gloves_history)[-6:]
        comp_g_votes = recent_gloves.count("COMPLIANT")
        viol_g_votes = recent_gloves.count("VIOLATION")

        if comp_g_votes >= 2:
            self.gloves_status = "COMPLIANT"
            if "NO_GLOVES" in self.active_violations:
                ev = self.active_violations.pop("NO_GLOVES")
                ev.status = "RESOLVED"
                ev.end_ts = round(float(ts), 2)
                ev.end_frame = frame_idx
        elif viol_g_votes >= 2:
            self.gloves_status = "VIOLATION"
            if "NO_GLOVES" not in self.active_violations:
                new_ev = SafetyEvent(
                    event_id=f"evt-{uuid.uuid4().hex[:8]}",
                    track_id=self.track_id,
                    event_type="NO_GLOVES",
                    severity="INFO",
                    start_ts=ts,
                    start_frame=frame_idx,
                    description=f"Worker #{self.track_id:03d} missing safety gloves",
                    confidence=0.80,
                    snapshot_b64=snapshot_b64,
                )
                self.active_violations["NO_GLOVES"] = new_ev
                self.all_recorded_events.append(new_ev)
            else:
                self.active_violations["NO_GLOVES"].end_ts = round(float(ts), 2)
                self.active_violations["NO_GLOVES"].end_frame = frame_idx
        else:
            self.gloves_status = "UNKNOWN"

        # 5. Overall safety status:
        if self.helmet_status == "VIOLATION" or self.vest_status == "VIOLATION" or self.boots_status == "VIOLATION":
            self.safety_status = "VIOLATION"
        elif self.helmet_status == "COMPLIANT" and self.vest_status == "COMPLIANT":
            self.safety_status = "COMPLIANT"
        else:
            self.safety_status = "UNKNOWN"

    def to_record(self) -> Dict[str, Any]:
        """Serializable representation for the live tracking panel and audit reports."""
        latest = self.latest_assessment
        return {
            "track_id": self.track_id,
            "first_seen": f"{self.first_seen_ts:.1f}s",
            "last_seen": f"{self.last_seen_ts:.1f}s",
            "first_seen_ts": self.first_seen_ts,
            "last_seen_ts": self.last_seen_ts,
            "helmet": self.helmet_status,
            "vest": self.vest_status,
            "boots": getattr(self, "boots_status", "UNKNOWN"),
            "gloves": getattr(self, "gloves_status", "UNKNOWN"),
            "safety_status": self.safety_status,
            "confidence": round(self.confidence, 3),
            "violations_count": len(self.all_recorded_events),
            "violations": [e.description for e in self.all_recorded_events],
            "state": self.state,
            "bbox": self.bbox,
            "helmet_bbox": self.helmet_bbox if self.helmet_status == "COMPLIANT" else None,
            "vest_bbox": self.vest_bbox if self.vest_status == "COMPLIANT" else None,
            "boots_bbox": getattr(self, "boots_bbox", None) if getattr(self, "boots_status", "UNKNOWN") == "COMPLIANT" else None,
            "gloves_bbox": getattr(self, "gloves_bbox", None) if getattr(self, "gloves_status", "UNKNOWN") == "COMPLIANT" else None,
            "helmet_confidence": round(latest.helmet_confidence, 3) if latest and latest.has_helmet else None,
            "vest_confidence": round(latest.vest_confidence, 3) if latest and latest.has_vest else None,
        }


def _track_match_score(boxA: List[float], boxB: List[float]) -> float:
    """
    Computes spatial association score between two bounding boxes.
    Combines Intersection-over-Union (IoU) with Centroid Proximity
    to preserve track IDs across movement, camera pans, and brief occlusions.
    """
    iou = calculate_iou(boxA, boxB)
    if iou >= 0.20:
        return iou

    cxA, cyA = (boxA[0] + boxA[2]) / 2.0, (boxA[1] + boxA[3]) / 2.0
    cxB, cyB = (boxB[0] + boxB[2]) / 2.0, (boxB[1] + boxB[3]) / 2.0
    dist = ((cxA - cxB) ** 2 + (cyA - cyB) ** 2) ** 0.5

    areaA = max(1e-5, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
    areaB = max(1e-5, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))
    area_ratio = min(areaA, areaB) / max(areaA, areaB)

    # If centroids are close (< 0.16 of frame) and box areas are reasonably consistent
    if dist <= 0.16 and area_ratio >= 0.30:
        spatial_affinity = max(0.0, 1.0 - dist * 3.0)
        return max(0.20, spatial_affinity * 0.6 + iou * 0.4)
    return 0.0


class MultiPersonTracker:
    """
    Real multi-person tracker using IoU + Centroid proximity association.
    Maintains persistent track IDs without track splitting or duplicate IDs.
    """
    def __init__(self, max_lost_frames: int = 40, iou_threshold: float = 0.20):
        self.max_lost = max_lost_frames
        self.iou_threshold = iou_threshold
        self.next_id = 1
        self.tracks: Dict[int, WorkerTrack] = {}

    def update(
        self,
        assessments: List[WorkerPPEAssessment],
        frame_idx: int,
        timestamp: float,
        snapshot_b64: Optional[str] = None,
    ) -> List[WorkerTrack]:
        """
        Updates tracks with new detections from the current frame.
        Returns list of currently active tracks.
        """
        # Active candidate tracks from previous frames
        active_track_ids = [tid for tid, trk in self.tracks.items() if trk.state in ("ACTIVE", "LOST")]

        matched_tracks = set()
        matched_detections = set()

        if active_track_ids and assessments:
            # Build cost matrix using spatial match score
            cost_matrix: List[Tuple[float, int, int]] = []  # (score, track_id, det_idx)
            for tid in active_track_ids:
                track = self.tracks[tid]
                for d_idx, det in enumerate(assessments):
                    score = _track_match_score(track.bbox, det.person_bbox)
                    if score >= self.iou_threshold:
                        cost_matrix.append((score, tid, d_idx))

            # Greedy assignment sorted by match score descending
            cost_matrix.sort(key=lambda x: x[0], reverse=True)
            for score, tid, d_idx in cost_matrix:
                if tid not in matched_tracks and d_idx not in matched_detections:
                    matched_tracks.add(tid)
                    matched_detections.add(d_idx)
                    self.tracks[tid].update(assessments[d_idx], frame_idx, timestamp, snapshot_b64)

        # Secondary pass: attempt reconnect with recently LOST / COMPLETED tracks before creating new ID
        unmatched_dets = [d_idx for d_idx in range(len(assessments)) if d_idx not in matched_detections]
        for d_idx in unmatched_dets:
            det = assessments[d_idx]
            best_reconnect_tid = None
            best_reconnect_score = 0.0

            for tid, trk in self.tracks.items():
                if tid not in matched_tracks:
                    score = _track_match_score(trk.bbox, det.person_bbox)
                    if score >= 0.20 and score > best_reconnect_score:
                        best_reconnect_score = score
                        best_reconnect_tid = tid

            if best_reconnect_tid is not None:
                matched_tracks.add(best_reconnect_tid)
                matched_detections.add(d_idx)
                self.tracks[best_reconnect_tid].update(det, frame_idx, timestamp, snapshot_b64)

        # Unmatched tracks -> mark missed
        for tid in active_track_ids:
            if tid not in matched_tracks:
                self.tracks[tid].mark_missed(frame_idx, timestamp, self.max_lost)

        # Remaining unmatched detections -> spawn new tracks
        for d_idx, det in enumerate(assessments):
            if d_idx not in matched_detections:
                new_track = WorkerTrack(
                    track_id=self.next_id,
                    initial_assessment=det,
                    frame_idx=frame_idx,
                    ts=timestamp,
                )
                self.tracks[self.next_id] = new_track
                self.next_id += 1

        return [trk for trk in self.tracks.values() if trk.state == "ACTIVE"]

    def get_all_tracks(self) -> List[WorkerTrack]:
        """
        Returns all verified tracks observed in the video.
        Filters out transient single-frame noise to prevent ghost worker tracks.
        """
        all_trks = list(self.tracks.values())
        # Strictly require at least 2 hits to confirm a real human worker
        verified = [t for t in all_trks if t.hits >= 2]
        return verified

    def get_all_safety_events(self) -> List[SafetyEvent]:
        """Returns all safety events generated across all tracks."""
        events = []
        for trk in self.tracks.values():
            events.extend(trk.all_recorded_events)
        events.sort(key=lambda e: e.start_ts)
        return events
