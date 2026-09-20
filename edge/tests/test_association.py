"""
Unit Tests for Person-PPE Spatial Association
Verifies containment, anatomical sub-region bounding box assignment, and violation detection.
"""

import pytest
from app.postprocess import Detection, associate_person_ppe

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
