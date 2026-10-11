"""
Unit Tests for Person-PPE Spatial Association
Verifies containment, anatomical sub-region bounding box assignment, and violation detection.
"""

import pytest
from app.postprocess import Detection, associate_person_ppe, filter_and_validate_detections

def test_compliant_worker():
    # Person from [0.2, 0.2, 0.5, 0.8]
    person = Detection(class_id=0, class_name="person", confidence=0.95, bbox=[0.2, 0.2, 0.5, 0.8], track_id=1)
    helmet = Detection(class_id=1, class_name="helmet", confidence=0.90, bbox=[0.3, 0.2, 0.4, 0.3])
    vest = Detection(class_id=3, class_name="vest", confidence=0.88, bbox=[0.25, 0.35, 0.45, 0.6])

    statuses = associate_person_ppe([person, helmet, vest], required_ppe=["helmet", "vest"])
    assert len(statuses) == 1
    assert statuses[0].has_helmet is True
    assert statuses[0].has_vest is True
    assert statuses[0].missing_items == []

def test_missing_helmet_and_vest():
    person = Detection(class_id=0, class_name="person", confidence=0.95, bbox=[0.2, 0.2, 0.5, 0.8], track_id=2)
    bare_head = Detection(class_id=2, class_name="head", confidence=0.85, bbox=[0.3, 0.2, 0.4, 0.3])

    statuses = associate_person_ppe([person, bare_head], required_ppe=["helmet", "vest"])
    assert len(statuses) == 1
    assert statuses[0].has_bare_head is True
    assert statuses[0].has_helmet is False
    assert "helmet" in statuses[0].missing_items
    assert "vest" in statuses[0].missing_items

def test_filter_hands_misdetected_as_boots():
    # Person: [0.2, 0.1, 0.5, 0.9] -> height is 0.8, waist/hands at y=0.5
    person = Detection(class_id=0, class_name="person", confidence=0.88, bbox=[0.2, 0.1, 0.5, 0.9])
    # Hand resting on container at waist level (y=0.48 - 0.54) misdetected as boots (rel_y = 0.51)
    false_boots = Detection(class_id=5, class_name="boots", confidence=0.84, bbox=[0.30, 0.48, 0.42, 0.54])
    
    validated = filter_and_validate_detections([person, false_boots])
    # False boots on hands must be suppressed!
    boot_dets = [d for d in validated if d.class_name == "boots"]
    assert len(boot_dets) == 0

def test_filter_yellow_helmet_misdetected_as_no_boots():
    # Person: [0.3, 0.1, 0.6, 0.9]
    person = Detection(class_id=0, class_name="person", confidence=0.90, bbox=[0.3, 0.1, 0.6, 0.9])
    # Yellow hardhat at head level (y=0.10 - 0.22) misdetected as no_boots (rel_y = 0.16)
    head_no_boots = Detection(class_id=7, class_name="no_boots", confidence=0.78, bbox=[0.40, 0.10, 0.52, 0.22])

    validated = filter_and_validate_detections([person, head_no_boots])
    # Must be reclassified to helmet and not remain no_boots
    assert not any(d.class_name == "no_boots" for d in validated)
    helmets = [d for d in validated if d.class_name == "helmet"]
    assert len(helmets) == 1
    assert helmets[0].confidence == 0.78

def test_filter_valid_boots_at_feet_preserved():
    # Person: [0.3, 0.1, 0.6, 0.9]
    person = Detection(class_id=0, class_name="person", confidence=0.90, bbox=[0.3, 0.1, 0.6, 0.9])
    # Real boots at feet level (y=0.80 - 0.90, rel_y = 0.85)
    real_boots = Detection(class_id=5, class_name="boots", confidence=0.75, bbox=[0.35, 0.80, 0.55, 0.90])

    validated = filter_and_validate_detections([person, real_boots])
    boot_dets = [d for d in validated if d.class_name == "boots"]
    assert len(boot_dets) == 1
    assert boot_dets[0].confidence == 0.75
