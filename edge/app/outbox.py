"""
Factory Safety AI - SQLite Outbox
Offline transactional outbox for guaranteed, idempotent alert delivery.
Alerts are stored locally first; a background worker synchronizes with the server.
"""

import json
import time
import sqlite3
import threading
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import requests

logger = logging.getLogger("edge.outbox")

class OutboxManager:
    """
    Transactional SQLite outbox ensuring zero data loss during network partition.
    """
    def __init__(self, db_path: str = "outbox.db", api_key: str = "edge-api-key-factory-plant-01"):
        self.db_path = db_path
        self.api_key = api_key
        self._lock = threading.Lock()
        self._init_db()
        self._worker_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._lock, self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS outbox_alerts (
                    id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'PENDING',
                    last_error TEXT
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_status ON outbox_alerts (status)")
            conn.commit()

    def enqueue_alert(self, alert_dict: Dict[str, Any]) -> None:
        """Atomically persist alert to local SQLite before network transmission."""
        alert_id = alert_dict.get("id")
        if not alert_id:
            import uuid
            alert_id = str(uuid.uuid4())
            alert_dict["id"] = alert_id

        payload_str = json.dumps(alert_dict)
        now = time.time()

        with self._lock, self._get_connection() as conn:
            conn.execute("""
                INSERT OR IGNORE INTO outbox_alerts (id, payload, created_at, attempts, status)
                VALUES (?, ?, ?, 0, 'PENDING')
            """, (alert_id, payload_str, now))
            conn.commit()
        logger.info(f"[*] Alert {alert_id} enqueued in local SQLite outbox.")

    def get_pending_count(self) -> int:
        """Returns the number of alerts waiting to be synchronized."""
        with self._lock, self._get_connection() as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM outbox_alerts WHERE status = 'PENDING'")
            return cursor.fetchone()[0]

    def get_recent_alerts(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieve recent alerts from outbox."""
        with self._lock, self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT id, payload, created_at, attempts, status FROM outbox_alerts ORDER BY created_at DESC LIMIT ?",
                (limit,)
            )
            results = []
            for row in cursor.fetchall():
                try:
                    data = json.loads(row["payload"])
                    data["_outbox_status"] = row["status"]
                    data["_outbox_attempts"] = row["attempts"]
                    results.append(data)
                except Exception:
                    pass
            return results

    def sync_batch(self, server_url: str, batch_size: int = 20) -> int:
        """Attempts to sync pending alerts to the server endpoint."""
        with self._lock, self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT id, payload, attempts FROM outbox_alerts
                WHERE status = 'PENDING'
                ORDER BY created_at ASC
                LIMIT ?
            """, (batch_size,))
            rows = cursor.fetchall()

        if not rows:
            return 0

        synced_count = 0
        endpoints = [
            f"{server_url}/edge/alerts",
            f"{server_url}/api/edge/alerts",
        ]

        base_headers = {"X-Edge-Api-Key": self.api_key}

        for row in rows:
            alert_id = row["id"]
            attempts = row["attempts"] + 1
            payload = json.loads(row["payload"])

            success = False
            error_msg = ""
            snapshot_path = payload.get("snapshot_path")

            for ep in endpoints:
                try:
                    if snapshot_path and Path(snapshot_path).is_file():
                        with open(snapshot_path, "rb") as f:
                            files = {"snapshot": (Path(snapshot_path).name, f, "image/jpeg")}
                            data = {"payload": json.dumps(payload)}
                            resp = requests.post(ep, data=data, files=files, headers=base_headers, timeout=5.0)
                    else:
                        json_headers = {**base_headers, "Content-Type": "application/json"}
                        resp = requests.post(ep, json=payload, headers=json_headers, timeout=5.0)

                    if resp.status_code in [200, 201]:
                        success = True
                        break
                    else:
                        error_msg = f"HTTP {resp.status_code}: {resp.text[:100]}"
                except Exception as e:
                    error_msg = str(e)

            with self._lock, self._get_connection() as conn:
                if success:
                    conn.execute(
                        "UPDATE outbox_alerts SET status = 'DELIVERED', attempts = ? WHERE id = ?",
                        (attempts, alert_id)
                    )
                    synced_count += 1
                else:
                    conn.execute(
                        "UPDATE outbox_alerts SET attempts = ?, last_error = ? WHERE id = ?",
                        (attempts, error_msg, alert_id)
                    )
                conn.commit()

        return synced_count

    def start_worker(self, server_url: str, poll_interval: float = 2.0) -> None:
        """Starts background daemon synchronizing outbox alerts."""
        if self._worker_thread and self._worker_thread.is_alive():
            return

        self._stop_event.clear()

        def _worker_loop():
            logger.info(f"[*] Outbox sync worker started targeting {server_url}")
            while not self._stop_event.is_set():
                try:
                    if self.get_pending_count() > 0:
                        self.sync_batch(server_url)
                except Exception as e:
                    logger.debug(f"Outbox sync error: {e}")
                self._stop_event.wait(poll_interval)

        self._worker_thread = threading.Thread(target=_worker_loop, daemon=True)
        self._worker_thread.start()

    def stop_worker(self) -> None:
        """Stops background synchronization worker."""
        self._stop_event.set()
        if self._worker_thread:
            self._worker_thread.join(timeout=2.0)
