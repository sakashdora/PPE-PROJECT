"""
Unit Tests for Cooldown Deduplication and SQLite Outbox
"""

import os
import time
import pytest
from app.postprocess import AlertCooldown
from app.outbox import OutboxManager

def test_alert_cooldown():
    cooldown = AlertCooldown(cooldown_seconds=1.0)
    key = "cam-01_ppe_violation"

    # 1st call should fire
    assert cooldown.should_fire(key) is True

    # 2nd immediate call should be suppressed
    assert cooldown.should_fire(key) is False

    # After cooldown expires, it should fire again
    time.sleep(1.05)
    assert cooldown.should_fire(key) is True

def test_outbox_persistence(tmp_path):
    db_file = str(tmp_path / "test_outbox.db")
    outbox = OutboxManager(db_path=db_file)

    assert outbox.get_pending_count() == 0

    alert = {
        "id": "test-alert-001",
        "severity": "CRITICAL",
        "type": "fire",
        "camera_id": "cam-01"
    }

    outbox.enqueue_alert(alert)
    assert outbox.get_pending_count() == 1

    recent = outbox.get_recent_alerts()
    assert len(recent) == 1
    assert recent[0]["id"] == "test-alert-001"
    assert recent[0]["_outbox_status"] == "PENDING"
