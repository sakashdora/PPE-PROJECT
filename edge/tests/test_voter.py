"""
Unit Tests for Temporal Sliding-Window Voter
Verifies 2/5 Fire/Smoke recall-first and 8/10 PPE precision-first voting logic.
"""

import pytest
from app.postprocess import TemporalVoter

def test_fire_voting_2_of_5():
    voter = TemporalVoter()
    key = "cam-01_fire"

    # Frame 1: Negative
    trig, votes = voter.vote(key, False, window_size=5, threshold=2)
    assert not trig
    assert votes == "0/1"

    # Frame 2: Negative
    trig, votes = voter.vote(key, False, window_size=5, threshold=2)
    assert not trig
    assert votes == "0/2"

    # Frame 3: Fire detected (1st positive)
    trig, votes = voter.vote(key, True, window_size=5, threshold=2)
    assert not trig
    assert votes == "1/3"

    # Frame 4: Fire detected (2nd positive in 5 frames -> TRIGGER!)
    trig, votes = voter.vote(key, True, window_size=5, threshold=2)
    assert trig
    assert votes == "2/4"

def test_transient_fire_glance_rejected():
    voter = TemporalVoter()
    key = "cam-02_fire"

    # Frame 1: False positive (e.g. yellow reflection)
    voter.vote(key, True, window_size=5, threshold=2)
    # Frames 2, 3, 4, 5: Negative
    for _ in range(4):
        trig, votes = voter.vote(key, False, window_size=5, threshold=2)
        assert not trig

    # Window now contains [0, 0, 0, 0, 0] (or 1/5 max)
    trig, votes = voter.vote(key, False, window_size=5, threshold=2)
    assert not trig
    assert votes == "0/5"

def test_ppe_voting_8_of_10():
    voter = TemporalVoter()
    key = "cam-01_ppe_worker_1"

    # Feed 7 positive frames out of 10 -> Should NOT trigger
    for _ in range(7):
        trig, votes = voter.vote(key, True, window_size=10, threshold=8)
        assert not trig

    # Feed 8th positive frame -> TRIGGER!
    trig, votes = voter.vote(key, True, window_size=10, threshold=8)
    assert trig
    assert votes == "8/8"
