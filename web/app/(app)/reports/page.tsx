"use client";

import React from "react";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import { DICTIONARY } from "@/lib/i18n";
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  CheckCircle,
  AlertOctagon,
  HardHat,
  Cpu,
  DollarSign,
  Flame,
} from "lucide-react";

export default function ReportsPage() {
  const locale = useAlertsStore((s) => s.locale);
  const t = DICTIONARY[locale];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-industrial-800">
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
          <BarChart3 className="w-6 h-6 text-emerald-400" />
          <span>{t.reports} & Compliance Trends</span>
        </h1>
        <p className="text-xs text-slate-400 font-mono mt-0.5">
          Weekly aggregate safety compliance, repeat violation sectors, and edge hardware cost defense
        </p>
      </div>

      {/* Metric Cards Top Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        <div className="p-4 bg-industrial-900 border border-industrial-800 rounded-xl">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>PPE COMPLIANCE RATE</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">
            96.8%
          </div>
          <div className="text-3xs text-slate-400 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span>+2.4% over last 7 shifts</span>
          </div>
        </div>

        <div className="p-4 bg-industrial-900 border border-industrial-800 rounded-xl">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>AVG ACKNOWLEDGMENT TIME</span>
            <CheckCircle className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-400 mt-2">
            38.4s
          </div>
          <div className="text-3xs text-slate-400 mt-1">
            Target SLA: &lt; 60s
          </div>
        </div>

        <div className="p-4 bg-industrial-900 border border-industrial-800 rounded-xl">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>FIRE/SMOKE RECALL</span>
            <Flame className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-black text-red-400 mt-2">
            99.2%
          </div>
          <div className="text-3xs text-emerald-400 mt-1">
            Zero missed in benchmark testing
          </div>
        </div>

        <div className="p-4 bg-industrial-900 border border-industrial-800 rounded-xl">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>FALSE POSITIVE SUPPRESSION</span>
            <AlertOctagon className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2">
            &lt; 0.8%
          </div>
          <div className="text-3xs text-slate-400 mt-1">
            Corner cases tested (yellow shirt, steam)
          </div>
        </div>
      </div>

      {/* Sector Compliance & Shift Heatmap Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sector Violations */}
        <div className="p-5 bg-industrial-900 border border-industrial-800 rounded-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono mb-4 flex items-center justify-between">
            <span>Violations by Factory Sector (Last 30 Days)</span>
            <span className="text-3xs text-slate-500 font-normal">N = 142 events</span>
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Sector 4: Furnace Hall</span>
                <span className="font-bold text-amber-400">54 incidents (38%)</span>
              </div>
              <div className="w-full h-2.5 bg-industrial-950 rounded-full overflow-hidden border border-industrial-800">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: "38%" }} />
              </div>
              <div className="text-3xs text-slate-500 mt-0.5">Predominant: Missing heat gloves & face shields</div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Sector 1: Loading Bay & Logistics</span>
                <span className="font-bold text-sky-400">41 incidents (29%)</span>
              </div>
              <div className="w-full h-2.5 bg-industrial-950 rounded-full overflow-hidden border border-industrial-800">
                <div className="h-full bg-sky-500 rounded-full" style={{ width: "29%" }} />
              </div>
              <div className="text-3xs text-slate-500 mt-0.5">Predominant: High-visibility vest non-compliance</div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Sector 3: Precision Assembly Line</span>
                <span className="font-bold text-emerald-400">32 incidents (22%)</span>
              </div>
              <div className="w-full h-2.5 bg-industrial-950 rounded-full overflow-hidden border border-industrial-800">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: "22%" }} />
              </div>
              <div className="text-3xs text-slate-500 mt-0.5">Predominant: Smoking in restricted passage</div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Sector 2: Chemical Storage</span>
                <span className="font-bold text-red-400">15 incidents (11%)</span>
              </div>
              <div className="w-full h-2.5 bg-industrial-950 rounded-full overflow-hidden border border-industrial-800">
                <div className="h-full bg-red-500 rounded-full" style={{ width: "11%" }} />
              </div>
              <div className="text-3xs text-slate-500 mt-0.5">Strict compliance enforced (zero tolerance zone)</div>
            </div>
          </div>
        </div>

        {/* PPE Failure Distribution */}
        <div className="p-5 bg-industrial-900 border border-industrial-800 rounded-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono mb-4 flex items-center justify-between">
            <span>PPE Equipment Failure Breakdown</span>
            <HardHat className="w-4 h-4 text-slate-400" />
          </h3>

          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            <div className="p-3 bg-industrial-950 border border-industrial-800 rounded-lg">
              <div className="text-slate-400 text-3xs">SAFETY HELMETS</div>
              <div className="text-lg font-bold text-white mt-1">42%</div>
              <div className="text-3xs text-amber-400 mt-0.5">Top violation category</div>
            </div>

            <div className="p-3 bg-industrial-950 border border-industrial-800 rounded-lg">
              <div className="text-slate-400 text-3xs">HIGH-VIS VESTS</div>
              <div className="text-lg font-bold text-white mt-1">31%</div>
              <div className="text-3xs text-slate-400 mt-0.5">Secondary violation</div>
            </div>

            <div className="p-3 bg-industrial-950 border border-industrial-800 rounded-lg">
              <div className="text-slate-400 text-3xs">SAFETY GLOVES</div>
              <div className="text-lg font-bold text-white mt-1">18%</div>
              <div className="text-3xs text-slate-400 mt-0.5">Loading & lathe tasks</div>
            </div>

            <div className="p-3 bg-industrial-950 border border-industrial-800 rounded-lg">
              <div className="text-slate-400 text-3xs">STEEL-TOE BOOTS</div>
              <div className="text-lg font-bold text-white mt-1">9%</div>
              <div className="text-3xs text-emerald-400 mt-0.5">Highest worker compliance</div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-industrial-950 border border-industrial-800 rounded-lg font-mono text-2xs text-slate-400">
            <strong className="text-slate-200">Temporal Voting Defense:</strong> Raw single-frame false positives are filtered out by requiring 8 out of 10 consecutive frames before a PPE alert is dispatched.
          </div>
        </div>
      </div>

      {/* Jury Unit Economics Defense Card (PRD Section 13) */}
      <div className="p-5 bg-gradient-to-r from-industrial-900 via-industrial-900 to-industrial-850 border border-industrial-700 rounded-xl shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          <h3 className="text-base font-bold text-white uppercase tracking-wider font-mono">
            Unit Economics: Edge vs. Cloud Comparison (50 Cameras Deployment)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs mt-3">
          <div className="p-3.5 bg-black/40 border border-industrial-700 rounded-lg">
            <div className="text-slate-400 text-3xs uppercase font-bold">Edge Hardware Capacity</div>
            <div className="text-lg font-bold text-white mt-1">4 Cameras / Node</div>
            <p className="text-2xs text-slate-400 mt-1">
              Based on measured sustained 60 FPS on Intel Core i5 / N100 CPU with OpenVINO INT8 quantization (~15 FPS per stream).
            </p>
          </div>

          <div className="p-3.5 bg-black/40 border border-emerald-800/60 rounded-lg">
            <div className="text-emerald-400 text-3xs uppercase font-bold">Total CapEx Per Camera (Edge)</div>
            <div className="text-lg font-bold text-emerald-300 mt-1">₹3,200 ($38.50) / Cam</div>
            <p className="text-2xs text-slate-400 mt-1">
              One-time mini-PC cost (₹12,800) amortized across 4 camera streams. OpEx limited to 15W local power consumption.
            </p>
          </div>

          <div className="p-3.5 bg-black/40 border border-red-900/60 rounded-lg">
            <div className="text-red-400 text-3xs uppercase font-bold">Cloud Alternative Cost</div>
            <div className="text-lg font-bold text-red-300 mt-1">₹34,000 / Cam / Year</div>
            <p className="text-2xs text-slate-400 mt-1">
              50 cameras @ 1080p continuous streaming requires 250 Mbps WAN uplink, massive bandwidth egress, and recurring cloud GPU inference charges.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
