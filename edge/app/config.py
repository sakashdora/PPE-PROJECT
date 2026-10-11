"""
Factory Safety AI - Edge Configuration
Manages cameras, zones, detection thresholds, temporal voter parameters, and server endpoints.
Supports offline defaults with server hot-reload.
"""

import json
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from typing import Literal

PROJECT_ROOT = Path(os.environ.get("FACTORY_ROOT", str(Path(__file__).resolve().parents[2])))

class ZoneConfig(BaseModel):
    id: str
    name: str
    type: str = "mandatory_ppe"  # "exclusion" | "hazard" | "mandatory_ppe" | "smoking_restricted"
    polygon: List[List[float]] = []  # Normalized [[x, y], ...] in 0.0 - 1.0 range
    required_ppe: List[str] = ["helmet", "vest"]
    severity: str = "COMPLIANCE"

class CameraConfig(BaseModel):
    id: str
    name: str
    sector: str = "Sector 1"
    source: str = "synthetic"  # RTSP URL, MP4 file path, or "synthetic"
    fps_target: int = 10
    zones: List[ZoneConfig] = []

class ThresholdsConfig(BaseModel):
    person: float = 0.38        # Calibrated for reliable worker detection (preserves distant/partially occluded workers)
    helmet: float = 0.35        # Detects white, yellow, and colored hardhats accurately
    head: float = 0.45          # Bare head detection threshold (confident detection to avoid false violations)
    vest: float = 0.40          # Hi-vis torso compliance (rejects normal shirts and background clutter)
    gloves: float = 0.40        # Hand protection compliance
    boots: float = 0.40         # Steel-toe footwear compliance
    no_gloves: float = 0.45     # Bare hands violation
    no_boots: float = 0.45      # Footwear violation
    fire: float = 0.40          # Safety critical fire detection (high recall, rejects glare/welding flashes)
    smoke: float = 0.35         # Safety critical smoke detection (high recall, rejects steam/dust/blur)
    cigarette: float = 0.40     # Restricted smoking detection

class TemporalVoterConfig(BaseModel):
    fire_window: int = 5
    fire_threshold: int = 2     # 2 of 5 frames -> trigger alarm
    smoke_window: int = 5
    smoke_threshold: int = 2    # 2 of 5 frames -> trigger alarm
    smoking_window: int = 8
    smoking_threshold: int = 4  # 4 of 8 frames -> trigger warning
    ppe_window: int = 10
    ppe_threshold: int = 8      # 8 of 10 frames -> trigger compliance alert

class EdgeConfig(BaseModel):
    node_id: str = "edge-node-01"
    server_url: str = "http://localhost:4000"
    api_key: str = "edge-api-key-factory-plant-01"
    heartbeat_interval_sec: int = 5
    cooldown_seconds: int = 60
    db_path: str = str(PROJECT_ROOT / "outbox.db")
    snapshot_dir: str = str(PROJECT_ROOT / "snapshots")
    mode: Literal["onnx", "mock"] = "onnx"
    relay_pin: Optional[int] = None
    mjpeg_port: int = 8080
    model_path: str = str(PROJECT_ROOT / "models" / "best_s5.onnx")
    cameras: List[CameraConfig] = Field(default_factory=lambda: [
        CameraConfig(
            id="cam-01",
            name="Main Workshop - Assembly Line A",
            sector="Sector 1",
            source="synthetic",
            fps_target=10,
            zones=[
                ZoneConfig(
                    id="z-assembly-01",
                    name="Active Crane Zone",
                    type="mandatory_ppe",
                    polygon=[[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]],
                    required_ppe=["helmet", "vest", "boots"],
                    severity="COMPLIANCE",
                )
            ],
        ),
        CameraConfig(
            id="cam-02",
            name="Chemical & Boiler Room B",
            sector="Sector 2",
            source="synthetic",
            fps_target=10,
            zones=[
                ZoneConfig(
                    id="z-boiler-flame",
                    name="Flammable Gas Storage",
                    type="smoking_restricted",
                    polygon=[[0.15, 0.2], [0.85, 0.2], [0.85, 0.85], [0.15, 0.85]],
                    required_ppe=["helmet", "vest", "gloves", "boots"],
                    severity="WARNING",
                )
            ],
        ),
    ])
    thresholds: ThresholdsConfig = Field(default_factory=ThresholdsConfig)
    voter: TemporalVoterConfig = Field(default_factory=TemporalVoterConfig)

def load_config(config_path: str = "edge_config.json") -> EdgeConfig:
    """Load configuration from local JSON or initialize defaults."""
    p = Path(config_path)
    if p.exists():
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
            for env, key in [("SERVER_URL", "server_url"), ("EDGE_API_KEY", "api_key"), ("MODEL_PATH", "model_path"), ("DB_PATH", "db_path"), ("EDGE_MODE", "mode"), ("SNAPSHOTS_DIR", "snapshot_dir")]:
                if env in os.environ:
                    data[key] = os.environ[env]
            if os.environ.get("DEMO_MODE", "").lower() in ("1", "true", "yes", "on"):
                data["mode"] = "mock"
            return EdgeConfig(**data)
        except Exception as e:
            raise ValueError(f"Invalid edge configuration: {config_path}") from e
    data = {}
    for env, key in [("SERVER_URL", "server_url"), ("EDGE_API_KEY", "api_key"), ("MODEL_PATH", "model_path"), ("DB_PATH", "db_path"), ("EDGE_MODE", "mode"), ("SNAPSHOTS_DIR", "snapshot_dir"), ("MJPEG_PORT", "mjpeg_port"), ("RELAY_PIN", "relay_pin")]:
        if env in os.environ:
            data[key] = os.environ[env]
    if os.environ.get("DEMO_MODE", "").lower() in ("1", "true", "yes", "on"):
        data["mode"] = "mock"
    return EdgeConfig(**data)

def save_config(config: EdgeConfig, config_path: str = "edge_config.json") -> None:
    """Persist active configuration to disk."""
    p = Path(config_path)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(config.model_dump(), f, indent=2)
