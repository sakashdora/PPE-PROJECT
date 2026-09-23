"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  CheckCircle,
  AlertOctagon,
  HardHat,
  DollarSign,
  Flame,
  Calendar,
} from "lucide-react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";

// Data for Sector Violations (strictly Forge palette)
const SECTOR_DATA = [
  { sector: "Sector 1", name: "Loading Bay", count: 41, primary: "High-Vis Vest Breach", fill: "#C6752B" }, // Signal Copper
  { sector: "Sector 2", name: "Chemical Storage", count: 15, primary: "Zero Tolerance (Fire/Thermal)", fill: "#C1272D" }, // Critical
  { sector: "Sector 3", name: "Assembly Line", count: 32, primary: "Smoking in Zone", fill: "#E8700A" }, // Warning
  { sector: "Sector 4", name: "Furnace Hall", count: 54, primary: "Missing Heat Gloves", fill: "#7A7368" }, // Neutral
];

// Data for 7-Day Compliance Trends
const TREND_DATA = [
  { shift: "Day 1", helmet: 94.2, vest: 91.5, gloves: 85.0, boots: 97.8 },
  { shift: "Day 2", helmet: 95.0, vest: 92.0, gloves: 86.4, boots: 98.1 },
  { shift: "Day 3", helmet: 94.8, vest: 93.1, gloves: 87.0, boots: 98.0 },
  { shift: "Day 4", helmet: 96.0, vest: 92.8, gloves: 88.2, boots: 98.5 },
  { shift: "Day 5", helmet: 95.7, vest: 93.5, gloves: 87.8, boots: 98.2 },
  { shift: "Day 6", helmet: 96.5, vest: 94.0, gloves: 89.1, boots: 98.6 },
  { shift: "Day 7", helmet: 96.8, vest: 93.8, gloves: 88.6, boots: 98.4 },
];

// Data for Shift Breakdown
const SHIFT_DATA = [
  { shift: "Shift A (Morning)", critical: 0, warning: 1, compliance: 5 },
  { shift: "Shift B (Evening)", critical: 1, warning: 2, compliance: 8 },
  { shift: "Shift C (Night)", critical: 0, warning: 3, compliance: 11 },
];

// Custom Tooltip for Sector Chart
const SectorCustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-elevated border border-border p-3 rounded-sm font-mono text-xs">
        <div className="font-bold text-text-primary mb-1">{data.sector}: {data.name}</div>
        <div className="text-copper font-medium">{data.count} Recorded Incidents</div>
        <div className="text-text-secondary text-[9px] mt-1">Predominant: {data.primary}</div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Trend Chart
const TrendCustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-elevated border border-border p-3 rounded-sm font-mono text-xs">
        <div className="font-bold text-text-primary mb-1.5">{label} Multi-Class Compliance</div>
        {payload.map((item: any) => (
          <div key={item.name} className="flex items-center justify-between gap-4 py-0.5 text-[9px]">
            <span style={{ color: item.color }} className="capitalize font-medium">
              {item.name}:
            </span>
            <span className="font-bold text-text-primary">{item.value}%</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function ReportsPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState("Trailing 7 Days");
  const kpiRef = React.useRef<(HTMLDivElement | null)[]>([]);
  const chartsRef = React.useRef<(HTMLDivElement | null)[]>([]);

  useGSAP(() => {
    gsap.from(kpiRef.current, {
      y: 20,
      opacity: 0,
      duration: 0.5,
      stagger: 0.1,
      ease: "power2.out",
    });

    gsap.from(chartsRef.current, {
      y: 30,
      opacity: 0,
      duration: 0.6,
      stagger: 0.15,
      ease: "power3.out",
      delay: 0.2,
    });
  }, []);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight flex items-center gap-2.5 font-display">
            <BarChart3 className="w-6 h-6 text-copper" />
            <span>Safety Intelligence & Compliance Analytics</span>
          </h1>
          <p className="text-xs text-text-secondary font-mono mt-0.5">
            Empirical incident trends, multi-camera violation densities, and edge unit economics defense
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <Calendar className="w-3.5 h-3.5 text-copper" />
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="bg-surface border border-border text-text-primary px-3 py-1.5 rounded-sm focus:outline-none focus:border-copper text-xs transition-colors"
          >
            <option>Trailing 7 Days</option>
            <option>Last 30 Days</option>
            <option>Quarter to Date (Q3)</option>
          </select>
        </div>
      </div>

      {/* Metric Cards Top Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div ref={(el) => { kpiRef.current[0] = el; }} className="p-4 bg-surface border border-border rounded-sm forge-surface-active">
          <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary">
            <span className="uppercase font-bold tracking-wider">AGGREGATE PPE COMPLIANCE</span>
            <ShieldCheck className="w-4 h-4 text-safe" />
          </div>
          <div className="text-3xl font-bold text-text-primary mt-2 font-display">
            96.8%
          </div>
          <div className="text-[9px] text-text-secondary mt-1 flex items-center gap-1 font-mono">
            <TrendingUp className="w-3 h-3 text-safe" />
            <span className="text-safe">+2.4% over trailing 7 shifts</span>
          </div>
        </div>

        <div ref={(el) => { kpiRef.current[1] = el; }} className="p-4 bg-surface border border-border rounded-sm forge-surface-active">
          <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary">
            <span className="uppercase font-bold tracking-wider">AVG ACKNOWLEDGMENT SLA</span>
            <CheckCircle className="w-4 h-4 text-copper" />
          </div>
          <div className="text-3xl font-bold text-text-primary mt-2 font-display">
            38.4s
          </div>
          <div className="text-[9px] text-text-secondary mt-1 font-mono">
            Target SLA: &lt; 60s (CAS Verified)
          </div>
        </div>

        <div ref={(el) => { kpiRef.current[2] = el; }} className="p-4 bg-surface border border-border rounded-sm forge-surface-active">
          <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary">
            <span className="uppercase font-bold tracking-wider">FIRE / SMOKE RECALL</span>
            <Flame className="w-4 h-4 text-critical" />
          </div>
          <div className="text-3xl font-bold text-text-primary mt-2 font-display">
            99.2%
          </div>
          <div className="text-[9px] text-safe mt-1 font-mono">
            Zero missed in benchmark testing
          </div>
        </div>

        <div ref={(el) => { kpiRef.current[3] = el; }} className="p-4 bg-surface border border-border rounded-sm forge-surface-active">
          <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary">
            <span className="uppercase font-bold tracking-wider">CORNER-CASE SUPPRESSION</span>
            <AlertOctagon className="w-4 h-4 text-warning" />
          </div>
          <div className="text-3xl font-bold text-text-primary mt-2 font-display">
            0.0% FPR
          </div>
          <div className="text-[9px] text-text-secondary mt-1 font-mono">
            Yellow shirt hard-negatives passed
          </div>
        </div>
      </div>

      {/* Main Charts Grid: Sector Violations & 7-Day Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Interactive Sector Violations Bar Chart */}
        <div ref={(el) => { chartsRef.current[0] = el; }} className="p-5 bg-surface border border-border rounded-sm flex flex-col forge-surface-active">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider font-display">
                Violations by Factory Sector (30-Day Density)
              </h3>
              <p className="text-[9px] text-text-secondary font-mono mt-0.5">
                Total N = 142 events · Filtered by 8/10 temporal voting
              </p>
            </div>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-sm bg-copper/15 text-copper border border-copper">
              Interactive
            </span>
          </div>

          <div className="h-64 w-full font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SECTOR_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="sectorBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C6752B" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#C6752B" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#3A332A" vertical={false} />
                <XAxis dataKey="sector" stroke="#A69C8C" fontSize={10} tickLine={false} />
                <YAxis stroke="#A69C8C" fontSize={10} tickLine={false} />
                <Tooltip content={<SectorCustomTooltip />} cursor={{ fill: "rgba(198, 117, 43, 0.08)" }} />
                <Bar dataKey="count" fill="url(#sectorBarGrad)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-border text-center text-[9px] font-mono">
            {SECTOR_DATA.map((s) => (
              <div key={s.sector} className="p-1.5 rounded-sm bg-elevated border border-border">
                <div className="font-bold text-text-primary">{s.sector}</div>
                <div className="text-text-secondary truncate">{s.primary}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 7-Day Multi-Class Safety Trend Area Chart */}
        <div ref={(el) => { chartsRef.current[1] = el; }} className="p-5 bg-surface border border-border rounded-sm flex flex-col forge-surface-active">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider font-display">
                7-Day Multi-Class Compliance Dynamics
              </h3>
              <p className="text-[9px] text-text-secondary font-mono mt-0.5">
                Daily worker compliance rates for Helmet, Vest, Gloves & Boots
              </p>
            </div>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-sm bg-safe-bg text-safe border border-safe">
              Sustained 96%+
            </span>
          </div>

          <div className="h-64 w-full font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TREND_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="helmetGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2E8B57" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#2E8B57" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="vestGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C6752B" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#C6752B" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#3A332A" vertical={false} />
                <XAxis dataKey="shift" stroke="#A69C8C" fontSize={10} tickLine={false} />
                <YAxis domain={[80, 100]} stroke="#A69C8C" fontSize={10} tickLine={false} />
                <Tooltip content={<TrendCustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} />
                <Area type="monotone" dataKey="helmet" name="Helmet" stroke="#2E8B57" strokeWidth={2} fill="url(#helmetGrad)" />
                <Area type="monotone" dataKey="vest" name="Vest" stroke="#C6752B" strokeWidth={2} fill="url(#vestGrad)" />
                <Area type="monotone" dataKey="gloves" name="Gloves" stroke="#E8700A" strokeWidth={1.5} fill="none" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="boots" name="Boots" stroke="#7A7368" strokeWidth={1.5} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 pt-3 border-t border-border text-[9px] text-text-secondary font-mono flex items-center justify-between">
            <span>Temporal Voting Defense: 8/10 frames required to flag missing gear.</span>
            <span className="text-safe font-bold">Zero Nuisance Alarms</span>
          </div>
        </div>
      </div>

      {/* Secondary Row: Shift Incident Distribution & Equipment Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Shift Breakdown */}
        <div ref={(el) => { chartsRef.current[2] = el; }} className="p-5 bg-surface border border-border rounded-sm forge-surface-active">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider font-display mb-4 flex items-center justify-between">
            <span>Shift Incident Distribution (Shift A, B, C)</span>
            <span className="text-[9px] text-text-secondary font-mono font-medium">Past 142 Shifts</span>
          </h3>

          <div className="h-52 w-full font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SHIFT_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3A332A" vertical={false} />
                <XAxis dataKey="shift" stroke="#A69C8C" fontSize={10} tickLine={false} />
                <YAxis stroke="#A69C8C" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#211D17", borderColor: "#3A332A", borderRadius: "2px", fontSize: "10px" }}
                />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
                <Bar dataKey="critical" name="Critical (Fire)" fill="#C1272D" radius={[2, 2, 0, 0]} />
                <Bar dataKey="warning" name="Warning (Smoking)" fill="#E8700A" radius={[2, 2, 0, 0]} />
                <Bar dataKey="compliance" name="Compliance (PPE)" fill="#7A7368" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PPE Equipment Breakdown Grid */}
        <div ref={(el) => { chartsRef.current[3] = el; }} className="p-5 bg-surface border border-border rounded-sm flex flex-col justify-between forge-surface-active">
          <div>
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider font-display mb-4 flex items-center justify-between">
              <span>PPE Infraction Distribution</span>
              <HardHat className="w-4 h-4 text-copper" />
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-base border border-border rounded-sm">
                <div className="text-text-secondary text-[9px] font-bold">SAFETY HELMETS</div>
                <div className="text-xl font-bold text-text-primary mt-1 font-display">42%</div>
                <div className="text-[9px] text-warning mt-0.5">Top violation in Sector 4</div>
              </div>

              <div className="p-3 bg-base border border-border rounded-sm">
                <div className="text-text-secondary text-[9px] font-bold">HIGH-VIS VESTS</div>
                <div className="text-xl font-bold text-text-primary mt-1 font-display">31%</div>
                <div className="text-[9px] text-text-secondary mt-0.5">Logistics zone drift</div>
              </div>

              <div className="p-3 bg-base border border-border rounded-sm">
                <div className="text-text-secondary text-[9px] font-bold">HEAT GLOVES</div>
                <div className="text-xl font-bold text-text-primary mt-1 font-display">18%</div>
                <div className="text-[9px] text-text-secondary mt-0.5">Furnace & lathe tasks</div>
              </div>

              <div className="p-3 bg-base border border-border rounded-sm">
                <div className="text-text-secondary text-[9px] font-bold">STEEL-TOE BOOTS</div>
                <div className="text-xl font-bold text-text-primary mt-1 font-display">9%</div>
                <div className="text-[9px] text-safe mt-0.5">Highest worker compliance</div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-base border border-border rounded-sm text-[9px] text-text-secondary font-mono">
            <strong className="text-text-primary">ISO 45001 Compliance Audit:</strong> Automated logging of violation duration and supervisor CAS acknowledgment records provide end-to-end regulatory traceability.
          </div>
        </div>
      </div>

      {/* Hackathon Jury Unit Economics Defense Card */}
      <div ref={(el) => { chartsRef.current[4] = el; }} className="p-6 bg-surface border border-copper rounded-sm relative overflow-hidden forge-surface-active">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-5 h-5 text-copper" />
          <h3 className="text-base font-bold text-text-primary uppercase tracking-wider font-display">
            Jury Unit Economics: Edge NUC vs. Cloud Deployment (50 Cameras Deployment)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 font-mono">
          <div className="p-4 bg-base border border-border rounded-sm">
            <div className="text-text-secondary text-[9px] uppercase font-bold">Edge Capacity Per Node</div>
            <div className="text-2xl font-bold text-text-primary mt-1 font-display">4 Cameras / NUC</div>
            <p className="text-[9px] text-text-secondary mt-1.5 leading-relaxed">
              Sustained 60 FPS total on Intel Core i5 / N100 CPU via OpenVINO INT8 quantization (~15 FPS per camera feed).
            </p>
          </div>

          <div className="p-4 bg-safe-bg border border-safe rounded-sm">
            <div className="text-safe text-[9px] uppercase font-bold">CapEx Per Camera (ARGUS Edge)</div>
            <div className="text-2xl font-bold text-safe mt-1 font-display">₹3,200 ($38.50) / Cam</div>
            <p className="text-[9px] text-text-primary mt-1.5 leading-relaxed">
              One-time hardware mini-PC cost (₹12,800) amortized across 4 cameras. Ongoing OpEx limited to 15W local power.
            </p>
          </div>

          <div className="p-4 bg-critical-bg border border-critical rounded-sm">
            <div className="text-critical text-[9px] uppercase font-bold">Cloud SaaS Alternative Cost</div>
            <div className="text-2xl font-bold text-critical mt-1 font-display">₹34,000 / Cam / Year</div>
            <p className="text-[9px] text-text-primary mt-1.5 leading-relaxed">
              50 cameras @ 1080p requires 250 Mbps WAN uplink, continuous egress bandwidth, and recurring GPU inference fees.
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center justify-between text-[10px] text-text-secondary font-mono">
          <div>
            <strong className="text-text-primary">ROI Period:</strong> ~6 months based on incident lawsuit mitigation, insurance discounts (5–15%), and zero recurring cloud licenses.
          </div>
          <div className="text-copper font-bold bg-copper/15 border border-copper px-2 py-0.5 rounded-sm">
            10.6x Total Cost Advantage Over 3 Years
          </div>
        </div>
      </div>
    </div>
  );
}
