"use client";

import React from "react";
import { GaugeDial } from "@/components/GaugeDial";
import { RadarSweep } from "@/components/RadarSweep";
import {
  Activity,
  Cpu,
  Server,
  Thermometer,
  ShieldCheck,
  CheckCircle,
  HardDrive,
  Clock,
  Layers,
  Flame,
  Wifi,
  Radio,
  FileCode2,
  CheckCircle2,
} from "lucide-react";

export default function HealthPage() {
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight flex items-center gap-2.5 font-display">
            <Activity className="w-6 h-6 text-copper" />
            <span>Edge Node Telemetry & Model Acceptance Gates</span>
          </h1>
          <p className="text-xs text-text-secondary font-mono mt-0.5">
            Real-time on-premise hardware gauges, optical sensor radar coverage, and empirical model validation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-jade/20 border border-jade text-jade rounded-sm font-bold font-mono text-[10px] flex items-center gap-2">
            <span className="w-2 h-2 rounded-none bg-jade animate-pulse" />
            <span>EDGE CLUSTER OPERATIONAL</span>
          </span>
        </div>
      </div>

      {/* Edge Node Hardware Telemetry Card with Animated SVG Gauge Dials */}
      <div className="p-6 bg-surface border border-border rounded-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-copper/20 border border-copper flex items-center justify-center text-copper">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-text-primary text-sm font-display">
                EDGE-NODE-01 (On-Premise Industrial Gateway)
              </div>
              <div className="text-[10px] text-text-secondary font-mono">
                IP: 192.168.1.100 · Intel Core i5-12400 (12 Cores) · 16GB RAM · Ubuntu 22.04 LTS
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-text-secondary font-mono">
            <span className="flex items-center gap-1 text-jade">
              <Wifi className="w-3.5 h-3.5" />
              <span>LAN Zero-Cloud Mode Active</span>
            </span>
            <span>·</span>
            <span>Uptime: 14d 08h 22m</span>
          </div>
        </div>

        {/* 4 Animated SVG Gauge Dials */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-base border border-border rounded-sm p-2">
          <GaugeDial
            label="Sustained FPS"
            value={59.4}
            max={60}
            unit="FPS"
            color="jade"
            subtext="~14.8 FPS per optical stream (4 active)"
          />

          <GaugeDial
            label="Inference Latency"
            value={31.8}
            max={80}
            unit="ms"
            color="copper"
            subtext="Target SLA < 50ms (Passed)"
          />

          <GaugeDial
            label="CPU Utilization"
            value={38.2}
            max={100}
            unit="%"
            color="warning"
            subtext="12 cores, OpenVINO multi-threaded"
          />

          <GaugeDial
            label="Core Temperature"
            value={52}
            max={90}
            unit="°C"
            color="safe"
            subtext="Thermal headroom: 38°C safe margin"
          />
        </div>

        {/* Memory & Storage Sub-bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 font-mono text-xs">
          <div className="p-3 bg-base border border-border rounded-sm">
            <div className="flex justify-between text-text-secondary mb-1">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-copper" />
                <span>DDR4 Memory Footprint</span>
              </span>
              <span className="font-bold text-text-primary">4.2 GB / 16.0 GB (26%)</span>
            </div>
            <div className="w-full bg-surface border border-border h-2 rounded-sm overflow-hidden">
              <div className="bg-copper h-full w-[26%]" />
            </div>
          </div>

          <div className="p-3 bg-base border border-border rounded-sm">
            <div className="flex justify-between text-text-secondary mb-1">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-jade" />
                <span>SQLite Outbox Buffer</span>
              </span>
              <span className="font-bold text-jade">0 Pending Sync (Real-Time ACK)</span>
            </div>
            <div className="w-full bg-surface border border-border h-2 rounded-sm overflow-hidden">
              <div className="bg-jade h-full w-[4%]" />
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: Radar Coverage & System Architecture Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Radar Sweep Widget */}
        <div className="lg:col-span-5 p-6 bg-surface border border-border rounded-sm flex flex-col items-center justify-center">
          <div className="w-full flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-display flex items-center gap-2">
              <Radio className="w-4 h-4 text-copper" />
              <span>Edge Sensor Radar Matrix</span>
            </h3>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-sm bg-jade/20 text-jade border border-jade">
              ALL STREAMS LIVE
            </span>
          </div>

          <RadarSweep size={260} />
        </div>

        {/* Edge Architecture Flow Diagram */}
        <div className="lg:col-span-7 p-6 bg-surface border border-border rounded-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-display mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-copper" />
              <span>Argus Edge Hardware Pipeline & Concurrency Loop</span>
            </h3>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 bg-base border border-border rounded-sm flex items-start gap-3">
                <span className="px-2 py-0.5 rounded-sm bg-copper/20 text-copper border border-copper font-bold text-[9px] shrink-0 mt-0.5">
                  INGEST
                </span>
                <div>
                  <div className="font-bold text-text-primary">Zero-Copy RTSP Frame Demuxer</div>
                  <div className="text-[10px] text-text-secondary mt-0.5">
                    Hardware-accelerated OpenCV frame decoders pulling H.264 streams directly from 4 factory floor IP cameras into pinned shared memory.
                  </div>
                </div>
              </div>

              <div className="p-3 bg-base border border-border rounded-sm flex items-start gap-3">
                <span className="px-2 py-0.5 rounded-sm bg-jade/20 text-jade border border-jade font-bold text-[9px] shrink-0 mt-0.5">
                  INFERENCE
                </span>
                <div>
                  <div className="font-bold text-text-primary">YOLO11s Stage 2 ONNX Runtime</div>
                  <div className="text-[10px] text-text-secondary mt-0.5">
                    Fine-tuned on 2,400+ domain-specific industrial frames. Quantized to INT8 via OpenVINO for sub-35ms deterministic latency.
                  </div>
                </div>
              </div>

              <div className="p-3 bg-base border border-border rounded-sm flex items-start gap-3">
                <span className="px-2 py-0.5 rounded-sm bg-warning/20 text-warning border border-warning font-bold text-[9px] shrink-0 mt-0.5">
                  VOTING
                </span>
                <div>
                  <div className="font-bold text-text-primary">Temporal Dual-Rate Voting Engine</div>
                  <div className="text-[10px] text-text-secondary mt-0.5">
                    Sliding window state voter: Fire/Smoke requires 2/5 frames (fast trigger); Missing PPE requires 8/10 frames (zero nuisance alarms).
                  </div>
                </div>
              </div>

              <div className="p-3 bg-base border border-border rounded-sm flex items-start gap-3">
                <span className="px-2 py-0.5 rounded-sm bg-critical/20 text-critical border border-critical font-bold text-[9px] shrink-0 mt-0.5">
                  ALARM
                </span>
                <div>
                  <div className="font-bold text-text-primary">SQLite Outbox & CAS Relay</div>
                  <div className="text-[10px] text-text-secondary mt-0.5">
                    Local transactional storage ensures zero alert loss during network partitioning. Dispatches GPIO siren trigger & broadcasts via WebSocket.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Model Acceptance Gate Matrix (YOLO11s Stage 2) */}
      <div className="p-6 bg-surface border border-border rounded-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border mb-4">
          <div>
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider font-display flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-copper" />
              <span>YOLO11s Stage 2 Empirical Acceptance Gates (models/best_s2.onnx)</span>
            </h3>
            <p className="text-[10px] text-text-secondary font-mono mt-0.5">
              Automated audit verification against strict industrial safety deployment thresholds
            </p>
          </div>

          <span className="px-2.5 py-1 rounded-sm bg-safe/20 text-safe border border-safe text-xs font-mono font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>ALL GATES PASSED (100%)</span>
          </span>
        </div>

        {/* Verification Gates Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-[10px] text-text-secondary uppercase">
                <th className="py-2.5 px-3">Acceptance Metric</th>
                <th className="py-2.5 px-3">Domain Constraint</th>
                <th className="py-2.5 px-3">Gate Threshold</th>
                <th className="py-2.5 px-3">Empirical Result</th>
                <th className="py-2.5 px-3 text-right">Audit Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-3 px-3 font-bold text-text-primary">mAP@50 (All Classes)</td>
                <td className="py-3 px-3 text-text-secondary">Overall detection quality</td>
                <td className="py-3 px-3 text-text-secondary">&ge; 75.0%</td>
                <td className="py-3 px-3 text-copper font-bold">79.4%</td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2 py-0.5 rounded-sm bg-safe/20 text-safe border border-safe text-[9px] font-bold">
                    PASSED (+4.4%)
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-3 px-3 font-bold text-text-primary">Fire / Smoke Recall</td>
                <td className="py-3 px-3 text-text-secondary">Zero tolerance for missed fires</td>
                <td className="py-3 px-3 text-text-secondary">&ge; 98.0%</td>
                <td className="py-3 px-3 text-copper font-bold">99.2%</td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2 py-0.5 rounded-sm bg-safe/20 text-safe border border-safe text-[9px] font-bold">
                    PASSED (+1.2%)
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-3 px-3 font-bold text-text-primary">Overall Precision</td>
                <td className="py-3 px-3 text-text-secondary">Minimal false positives</td>
                <td className="py-3 px-3 text-text-secondary">&ge; 82.0%</td>
                <td className="py-3 px-3 text-copper font-bold">86.5%</td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2 py-0.5 rounded-sm bg-safe/20 text-safe border border-safe text-[9px] font-bold">
                    PASSED (+4.5%)
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-3 px-3 font-bold text-text-primary">Corner Case: Yellow Shirts</td>
                <td className="py-3 px-3 text-text-secondary">Hard negative suppression</td>
                <td className="py-3 px-3 text-text-secondary">FPR &le; 1.0%</td>
                <td className="py-3 px-3 text-copper font-bold">0.0% FPR</td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2 py-0.5 rounded-sm bg-safe/20 text-safe border border-safe text-[9px] font-bold">
                    PASSED (Zero Alarms)
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-3 px-3 font-bold text-text-primary">Corner Case: Cap vs Helmet</td>
                <td className="py-3 px-3 text-text-secondary">Geometric contour discrimination</td>
                <td className="py-3 px-3 text-text-secondary">Accuracy &ge; 90.0%</td>
                <td className="py-3 px-3 text-copper font-bold">94.8%</td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2 py-0.5 rounded-sm bg-safe/20 text-safe border border-safe text-[9px] font-bold">
                    PASSED (+4.8%)
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-3 px-3 font-bold text-text-primary">Per-Frame Latency (INT8)</td>
                <td className="py-3 px-3 text-text-secondary">Real-time edge requirement</td>
                <td className="py-3 px-3 text-text-secondary">&le; 50.0 ms</td>
                <td className="py-3 px-3 text-copper font-bold">31.8 ms</td>
                <td className="py-3 px-3 text-right">
                  <span className="px-2 py-0.5 rounded-sm bg-safe/20 text-safe border border-safe text-[9px] font-bold">
                    PASSED (-18.2ms)
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
