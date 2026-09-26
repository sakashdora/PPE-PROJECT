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
    person: float = 0.50
    helmet: float = 0.65
    head: float = 0.30          # Bare head
    vest: float = 0.65
    gloves: float = 0.30
    boots: float = 0.30
    no_gloves: float = 0.35
    no_boots: float = 0.35
    fire: float = 0.30          # Safety critical — recall first
    smoke: float = 0.25         # Safety critical — recall first
    cigarette: float = 0.30

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
    db_path: str = "outbox.db"
    mjpeg_port: int = 8080
    model_path: str = "models/best_s5.onnx"
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
            return EdgeConfig(**data)
        except Exception as e:
            print(f"[!] Warning: Failed parsing {config_path} ({e}). Using defaults.")
    return EdgeConfig()

def save_config(config: EdgeConfig, config_path: str = "edge_config.json") -> None:
    """Persist active configuration to disk."""
    p = Path(config_path)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(config.model_dump(), f, indent=2)
