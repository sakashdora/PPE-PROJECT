"""
Unit tests for Person-to-PPE Association and Multi-Person Tracking Engines.
Verifies:
1. Helmet and vest spatial association
2. Helmet prevails over overlapping head detections
3. Bare head triggers violation when no helmet is present
4. Occluded/uncertain cases produce UNKNOWN
5. Bipartite matching prevents helmet sharing
6. Stable Track IDs across frames
7. Temporal hysteresis prevents single-frame flickering
8. Debounced continuous safety events
"""

import pytest
from app.postprocess import Detection
from app.association import associate_person_ppe_v2, WorkerPPEAssessment
from app.tracker import MultiPersonTracker, WorkerTrack


def test_helmet_and_vest_compliant():
    person = Detection(class_id=0, class_name="person", confidence=0.88, bbox=[0.2, 0.1, 0.5, 0.9])
    helmet = Detection(class_id=1, class_name="helmet", confidence=0.82, bbox=[0.3, 0.1, 0.42, 0.22])
    vest = Detection(class_id=3, class_name="vest", confidence=0.79, bbox=[0.28, 0.28, 0.45, 0.60])

    assessments = associate_person_ppe_v2([person], [helmet, vest])
    assert len(assessments) == 1
    a = assessments[0]
    assert a.has_helmet is True
    assert a.has_vest is True
    assert a.helmet_status == "COMPLIANT"
    assert a.vest_status == "COMPLIANT"
    assert a.safety_status == "COMPLIANT"
    assert a.missing_items == []


def test_helmet_prevails_over_overlapping_head():
    """
    CRITICAL REGRESSION TEST:
    When model detects BOTH helmet (e.g. white or yellow hardhat) AND head (face/hair region),
    the worker MUST be classified as COMPLIANT, not flagged as bare head violation!
    """
    person = Detection(class_id=0, class_name="person", confidence=0.85, bbox=[0.2, 0.1, 0.5, 0.9])
    # Helmet detected at top
    helmet = Detection(class_id=1, class_name="helmet", confidence=0.78, bbox=[0.31, 0.10, 0.41, 0.20])
    # Head also detected in head zone
    head = Detection(class_id=2, class_name="head", confidence=0.55, bbox=[0.32, 0.14, 0.40, 0.24])

    assessments = associate_person_ppe_v2([person], [helmet, head])
    assert len(assessments) == 1
    a = assessments[0]
    assert a.has_helmet is True
    assert a.helmet_status == "COMPLIANT"
    assert "NO_HELMET" not in a.violations
    assert "helmet" not in a.missing_items


def test_bare_head_without_helmet_is_violation():
    person = Detection(class_id=0, class_name="person", confidence=0.85, bbox=[0.2, 0.1, 0.5, 0.9])
    head = Detection(class_id=2, class_name="head", confidence=0.75, bbox=[0.31, 0.12, 0.41, 0.22])

    assessments = associate_person_ppe_v2([person], [head])
    assert len(assessments) == 1
    a = assessments[0]
    assert a.has_helmet is False
    assert a.has_head_detection is True
    assert a.helmet_status == "VIOLATION"
    assert "helmet" in a.missing_items
    assert a.safety_status == "VIOLATION"


def test_occluded_worker_neither_helmet_nor_head_is_unknown():
    person = Detection(class_id=0, class_name="person", confidence=0.75, bbox=[0.2, 0.1, 0.5, 0.9])
    # No helmet or head detections available (e.g. head occluded)
    assessments = associate_person_ppe_v2([person], [])
    assert len(assessments) == 1
    a = assessments[0]
    assert a.has_helmet is False
    assert a.has_head_detection is False
    assert a.helmet_status == "UNKNOWN"
    assert a.safety_status == "UNKNOWN"


def test_bipartite_matching_prevents_helmet_sharing():
    """
    Two adjacent workers close together. Only ONE helmet is detected.
    The helmet MUST be assigned to the closest worker, NOT shared between both.
    """
    p1 = Detection(class_id=0, class_name="person", confidence=0.90, bbox=[0.10, 0.10, 0.35, 0.90])
    p2 = Detection(class_id=0, class_name="person", confidence=0.88, bbox=[0.30, 0.10, 0.55, 0.90])

    # Helmet is centered on p1 (x=0.225)
    helmet = Detection(class_id=1, class_name="helmet", confidence=0.85, bbox=[0.18, 0.11, 0.27, 0.21])

    assessments = associate_person_ppe_v2([p1, p2], [helmet])
    assert len(assessments) == 2
    # Only one person gets the helmet
    compliant_count = sum(1 for a in assessments if a.has_helmet)
    assert compliant_count == 1
    assert assessments[0].has_helmet is True
    assert assessments[1].has_helmet is False


def test_tracker_maintains_stable_id_across_movement():
    tracker = MultiPersonTracker(max_lost_frames=10, iou_threshold=0.20)

    # Worker moves slightly across 5 frames
    for i in range(5):
        shift = i * 0.02
        p_bbox = [0.20 + shift, 0.10, 0.40 + shift, 0.80]
        h_bbox = [0.26 + shift, 0.11, 0.34 + shift, 0.21]
        det_p = Detection(class_id=0, class_name="person", confidence=0.90, bbox=p_bbox)
        det_h = Detection(class_id=1, class_name="helmet", confidence=0.85, bbox=h_bbox)
        assessments = associate_person_ppe_v2([det_p], [det_h])

        active_tracks = tracker.update(assessments, frame_idx=i, timestamp=i * 0.1)
        assert len(active_tracks) == 1
        assert active_tracks[0].track_id == 1  # ID must remain 1!
        assert active_tracks[0].helmet_status == "COMPLIANT"


def test_tracker_temporal_hysteresis_survives_single_frame_noise():
    tracker = MultiPersonTracker(max_lost_frames=10)

    # 4 compliant frames
    for i in range(4):
        p = Detection(class_id=0, class_name="person", confidence=0.90, bbox=[0.2, 0.1, 0.4, 0.8])
        h = Detection(class_id=1, class_name="helmet", confidence=0.85, bbox=[0.26, 0.11, 0.34, 0.21])
        assessments = associate_person_ppe_v2([p], [h])
        tracks = tracker.update(assessments, frame_idx=i, timestamp=i * 0.1)
        assert tracks[0].helmet_status == "COMPLIANT"

    # Frame 5: Helmet temporarily dropped due to blur/occlusion (neither helmet nor head)
    p_noisy = Detection(class_id=0, class_name="person", confidence=0.88, bbox=[0.2, 0.1, 0.4, 0.8])
    assessments_noisy = associate_person_ppe_v2([p_noisy], [])
    tracks = tracker.update(assessments_noisy, frame_idx=4, timestamp=0.4)
    # Hysteresis keeps the worker COMPLIANT, does NOT flicker to violation!
    assert tracks[0].helmet_status == "COMPLIANT"


def test_tracker_debounced_continuous_violation_event():
    tracker = MultiPersonTracker(max_lost_frames=10)

    # Worker with bare head and vest for 6 consecutive frames
    for i in range(6):
        p = Detection(class_id=0, class_name="person", confidence=0.90, bbox=[0.2, 0.1, 0.4, 0.8])
        head = Detection(class_id=2, class_name="head", confidence=0.80, bbox=[0.26, 0.12, 0.34, 0.22])
        vest = Detection(class_id=3, class_name="vest", confidence=0.82, bbox=[0.24, 0.22, 0.36, 0.55])
        assessments = associate_person_ppe_v2([p], [head, vest])
        tracker.update(assessments, frame_idx=i, timestamp=i * 0.5)

    events = tracker.get_all_safety_events()
    # Must generate ONE continuous event, NOT 6 duplicate events!
    assert len(events) == 1
    ev = events[0]
    assert ev.track_id == 1
    assert ev.event_type == "NO_HELMET"
    assert ev.start_ts == 0.5 or ev.start_ts == 0.0
    assert ev.end_ts == 2.5


def test_two_workers_one_helmet_one_not_never_double_counted():
    """
    Regression test: Two workers across 10 frames with movement.
    Worker 1 wears a helmet and vest (COMPLIANT).
    Worker 2 has bare head and wears a vest (VIOLATION for helmet, COMPLIANT for vest).
    Asserts:
    1. Exactly 2 unique tracks are created (NO double counting).
    2. Vest is reliably detected as COMPLIANT on both workers.
    3. Statuses remain stable without track splitting.
    """
    tracker = MultiPersonTracker(max_lost_frames=30)

    for frame_idx in range(10):
        shift = frame_idx * 0.01  # Worker 1 walks slightly to the right

        # Worker 1 (compliant: helmet + vest)
        p1 = Detection(class_id=0, class_name="person", confidence=0.88, bbox=[0.1 + shift, 0.1, 0.3 + shift, 0.8])
        h1 = Detection(class_id=1, class_name="helmet", confidence=0.82, bbox=[0.16 + shift, 0.11, 0.24 + shift, 0.22])
        v1 = Detection(class_id=3, class_name="vest", confidence=0.80, bbox=[0.14 + shift, 0.22, 0.26 + shift, 0.50])

        # Worker 2 (violation: bare head + vest)
        p2 = Detection(class_id=0, class_name="person", confidence=0.91, bbox=[0.6, 0.1, 0.8, 0.8])
        head2 = Detection(class_id=2, class_name="head", confidence=0.84, bbox=[0.66, 0.12, 0.74, 0.23])
        v2 = Detection(class_id=3, class_name="vest", confidence=0.78, bbox=[0.64, 0.22, 0.76, 0.50])

        assessments = associate_person_ppe_v2([p1, p2], [h1, v1, head2, v2])
        active_tracks = tracker.update(assessments, frame_idx=frame_idx, timestamp=frame_idx * 0.2)

        assert len(active_tracks) == 2

    all_tracks = tracker.get_all_tracks()
    # Must have EXACTLY 2 unique workers tracked, NOT 3 or 4!
    assert len(all_tracks) == 2, f"Expected 2 unique workers, got {len(all_tracks)}"

    # Identify tracks
    track_compliant = next((t for t in all_tracks if t.helmet_status == "COMPLIANT"), None)
    track_violation = next((t for t in all_tracks if t.helmet_status == "VIOLATION"), None)

    assert track_compliant is not None, "Worker wearing helmet must be found"
    assert track_violation is not None, "Worker with bare head must be found"

    # Both workers wear vests, so vest MUST be COMPLIANT on both!
    assert track_compliant.vest_status == "COMPLIANT", "Worker 1 vest must be COMPLIANT"
    assert track_violation.vest_status == "COMPLIANT", "Worker 2 vest must be COMPLIANT"

    assert track_compliant.safety_status == "COMPLIANT"
    assert track_violation.safety_status == "VIOLATION"


def test_intra_frame_person_nms_suppresses_duplicate_boxes():
    """Validates that two overlapping person proposals on the same physical person are suppressed."""
    from app.postprocess import filter_and_validate_detections

    # Two overlapping person boxes on the same individual (IoU ~ 0.65)
    p_primary = Detection(class_id=0, class_name="person", confidence=0.88, bbox=[0.2, 0.1, 0.5, 0.9])
    p_duplicate = Detection(class_id=0, class_name="person", confidence=0.52, bbox=[0.22, 0.12, 0.49, 0.88])

    dets = filter_and_validate_detections([p_primary, p_duplicate])
    persons = [d for d in dets if d.class_name == "person"]

    assert len(persons) == 1, "Duplicate overlapping person detection must be suppressed to prevent double counting"
    assert persons[0].confidence == 0.88


def test_worker_with_helmet_but_no_vest_is_vest_violation():
    """
    CRITICAL USER REQUIREMENT:
    When a worker wears a helmet but does NOT wear a vest:
    1. Helmet is COMPLIANT
    2. Vest is VIOLATION (NO_VEST)
    3. Overall safety is VIOLATION
    4. Worker is NOT falsely shown as compliant or wearing a vest!
    """
    person = Detection(class_id=0, class_name="person", confidence=0.89, bbox=[0.25, 0.15, 0.55, 0.85])
    helmet = Detection(class_id=1, class_name="helmet", confidence=0.82, bbox=[0.35, 0.16, 0.45, 0.26])

    assessments = associate_person_ppe_v2([person], [helmet])
    assert len(assessments) == 1
    a = assessments[0]
    assert a.has_helmet is True
    assert a.has_vest is False
    assert a.helmet_status == "COMPLIANT"
    assert a.vest_status == "VIOLATION"
    assert a.safety_status == "VIOLATION"
    assert "vest" in a.missing_items
    assert "NO_VEST" in a.violations


def test_tracker_vest_violation_and_continuous_event():
    """
    Validates tracker hysteresis and event recording for worker without vest:
    1. Sustained absence of vest locks into VIOLATION
    2. Generates a continuous NO_VEST SafetyEvent
    3. Does NOT latch to COMPLIANT
    """
    tracker = MultiPersonTracker(max_lost_frames=10)

    for i in range(5):
        p = Detection(class_id=0, class_name="person", confidence=0.90, bbox=[0.2, 0.1, 0.4, 0.8])
        h = Detection(class_id=1, class_name="helmet", confidence=0.85, bbox=[0.26, 0.11, 0.34, 0.21])
        assessments = associate_person_ppe_v2([p], [h])
        tracks = tracker.update(assessments, frame_idx=i, timestamp=i * 0.5)

        if i >= 2:
            assert tracks[0].vest_status == "VIOLATION"
            assert tracks[0].safety_status == "VIOLATION"

    events = tracker.get_all_safety_events()
    vest_events = [e for e in events if e.event_type == "NO_VEST"]
    assert len(vest_events) == 1
    assert vest_events[0].track_id == 1
    assert "missing hi-vis safety vest" in vest_events[0].description


def test_vest_not_stolen_by_adjacent_worker():
    """
    Validates that an adjacent worker standing beside a worker with a vest
    does NOT falsely match or steal the neighbor's vest.
    """
    # Worker 1 on left wearing vest
    p1 = Detection(class_id=0, class_name="person", confidence=0.91, bbox=[0.10, 0.10, 0.35, 0.85])
    h1 = Detection(class_id=1, class_name="helmet", confidence=0.86, bbox=[0.18, 0.11, 0.27, 0.21])
    v1 = Detection(class_id=3, class_name="vest", confidence=0.80, bbox=[0.16, 0.22, 0.29, 0.55])

    # Worker 2 on right wearing helmet but NO vest
    p2 = Detection(class_id=0, class_name="person", confidence=0.89, bbox=[0.38, 0.10, 0.62, 0.85])
    h2 = Detection(class_id=1, class_name="helmet", confidence=0.84, bbox=[0.45, 0.11, 0.55, 0.21])

    assessments = associate_person_ppe_v2([p1, p2], [h1, h2, v1])
    assert len(assessments) == 2

    # Worker 1 has vest
    assert assessments[0].has_vest is True
    assert assessments[0].vest_status == "COMPLIANT"
    assert assessments[0].safety_status == "COMPLIANT"

    # Worker 2 does NOT have vest
    assert assessments[1].has_vest is False
    assert assessments[1].vest_status == "VIOLATION"
    assert assessments[1].safety_status == "VIOLATION"


def test_two_workers_left_no_vest_right_compliant_localized_boxes():
    """
    CRITICAL MASTER PROMPT TEST:
    Worker on LEFT: wears yellow helmet, NO vest -> safety_status='VIOLATION', vest_bbox=None.
    Worker on RIGHT: wears helmet, wears vest -> safety_status='COMPLIANT', valid vest_bbox and helmet_bbox.
    """
    tracker = MultiPersonTracker(max_lost_frames=10, iou_threshold=0.20)

    # Worker Left: Person [0.28, 0.55, 0.41, 0.93], Helmet [0.33, 0.55, 0.37, 0.62], NO VEST
    p_left = Detection(class_id=0, class_name="person", confidence=0.85, bbox=[0.28, 0.55, 0.41, 0.93])
    h_left = Detection(class_id=1, class_name="helmet", confidence=0.74, bbox=[0.33, 0.55, 0.37, 0.62])

    # Worker Right: Person [0.48, 0.54, 0.58, 0.99], Helmet [0.50, 0.54, 0.54, 0.60], Vest [0.49, 0.62, 0.58, 0.78]
    p_right = Detection(class_id=0, class_name="person", confidence=0.87, bbox=[0.48, 0.54, 0.58, 0.99])
    h_right = Detection(class_id=1, class_name="helmet", confidence=0.77, bbox=[0.50, 0.54, 0.54, 0.60])
    v_right = Detection(class_id=3, class_name="vest", confidence=0.81, bbox=[0.49, 0.62, 0.58, 0.78])

    for frame_idx in range(4):
        assessments = associate_person_ppe_v2(
            [p_left, p_right],
            [h_left, h_right, v_right]
        )
        tracks = tracker.update(assessments, frame_idx=frame_idx, timestamp=frame_idx * 0.1)

    assert len(tracks) == 2
    # Find left and right tracks
    trk_left = next(t for t in tracks if t.bbox[0] < 0.35)
    trk_right = next(t for t in tracks if t.bbox[0] > 0.40)

    # Check Worker Left:
    assert trk_left.helmet_status == "COMPLIANT"
    assert trk_left.vest_status == "VIOLATION"
    assert trk_left.safety_status == "VIOLATION"
    rec_left = trk_left.to_record()
    assert rec_left["helmet_bbox"] is not None
    assert rec_left["vest_bbox"] is None
    assert rec_left["vest"] == "VIOLATION"
    assert rec_left["safety_status"] == "VIOLATION"

    # Check Worker Right:
    assert trk_right.helmet_status == "COMPLIANT"
    assert trk_right.vest_status == "COMPLIANT"
    assert trk_right.safety_status == "COMPLIANT"
    rec_right = trk_right.to_record()
    assert rec_right["helmet_bbox"] is not None
    assert rec_right["vest_bbox"] is not None
    assert rec_right["vest"] == "COMPLIANT"
    assert rec_right["safety_status"] == "COMPLIANT"



