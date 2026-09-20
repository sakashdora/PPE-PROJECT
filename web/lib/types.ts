export type Severity = "CRITICAL" | "WARNING" | "COMPLIANCE";

export type AlertType = "fire" | "smoke" | "smoking" | "missing_ppe";

export type Status = "open" | "acknowledged" | "resolved" | "false_alarm";

export type PPEItem = "helmet" | "vest" | "gloves" | "boots" | "no_helmet" | "no_gloves" | "no_boots" | "cigarette";

export interface BoundingBox {
  x1: number; // normalized 0.0 - 1.0 or pixel coordinate
  y1: number;
  x2: number;
  y2: number;
  label?: string;
  confidence?: number;
}

export interface Alert {
  id: string;
  ts: string; // ISO 8601
  updatedAt: string;
  cameraId: string;
  sector: string;
  zoneId?: string;
  severity: Severity;
  type: AlertType;
  items: string[];
  confidence: number;
  votes: string; // e.g. "3/5" or "8/10"
  modelVersion: string;
  snapshotUrl?: string;
  bbox?: [number, number, number, number]; // [x1, y1, x2, y2]
  status: Status;
  /** CAS version — required for PATCH /alerts/:id expectedVersion */
  version?: number;
  ackBy?: string;
  ackAt?: string;
  resolvedAt?: string;
  note?: string;
}

export type ConnectionStatus = "live" | "connecting" | "reconnecting" | "offline";

export interface CameraStream {
  id: string;
  name: string;
  sector: string;
  location: string;
  sourceType: "file" | "rtsp";
  sourceUrl: string;
  status: "online" | "stalled" | "offline";
  fps: number;
  latencyMs: number;
  lastSeen: string;
  resolution: string;
  activeAlertCount: number;
  hasCritical: boolean;
}

export interface ZonePoint {
  x: number; // 0.0 - 1.0
  y: number; // 0.0 - 1.0
}

export type ZoneKind = "smoking_restricted" | "ppe_required" | "hazard_high" | "ignore_zone";

export interface Zone {
  id: string;
  cameraId: string;
  name: string;
  kind: ZoneKind;
  polygon: ZonePoint[];
  color: string;
  active: boolean;
}

export interface EdgeNodeHealth {
  id: string;
  hostname: string;
  ip: string;
  status: "healthy" | "degraded" | "offline";
  fpsTotal: number;
  latencyMs: number;
  cpuPercent: number;
  ramPercent: number;
  temperatureC: number;
  activeStreams: number;
  activeModel: string;
  lastHeartbeat: string;
}

export interface ModelMetrics {
  version: string;
  architecture: string;
  runtime: "OpenVINO FP16" | "ONNX FP32" | "INT8";
  mAP50: number;
  mAP50_95: number;
  fireRecallClean: number;
  fireRecallDegraded: number;
  ppePrecision: number;
  cornerCaseFPR: {
    yellowShirt: number;
    capsAndBeanies: number;
    steamAndVapor: number;
    weldingGlare: number;
  };
  inferenceLatencyMs: number;
  benchmarkHardware: string;
}
