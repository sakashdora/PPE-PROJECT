"use client";

import React, { useState } from "react";
import {
  Sliders,
  AlertTriangle,
  Flame,
  HardHat,
  Cigarette,
  Layers,
  Save,
  CheckCircle,
  Clock,
} from "lucide-react";

export default function ThresholdsAdminPage() {
  const [fireThreshold, setFireThreshold] = useState<number>(0.65);
  const [smokeThreshold, setSmokeThreshold] = useState<number>(0.60);
  const [helmetThreshold, setHelmetThreshold] = useState<number>(0.75);
  const [vestThreshold, setVestThreshold] = useState<number>(0.70);
  const [glovesThreshold, setGlovesThreshold] = useState<number>(0.65);
  const [bootsThreshold, setBootsThreshold] = useState<number>(0.65);
  const [smokingThreshold, setSmokingThreshold] = useState<number>(0.70);

  const [fireVoteWindow, setFireVoteWindow] = useState<number>(5);
  const [fireVoteReq, setFireVoteReq] = useState<number>(2);

  const [ppeVoteWindow, setPpeVoteWindow] = useState<number>(10);
  const [ppeVoteReq, setPpeVoteReq] = useState<number>(8);

  const [cooldownSec, setCooldownSec] = useState<number>(30);
  const [saveToast, setSaveToast] = useState<boolean>(false);

  const handleSave = () => {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-industrial-800">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-amber-400" />
            <span>Thresholds & Temporal Voter Tuning</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Load and tune empirical detection thresholds and multi-frame voting rules (thresholds.json)
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-2 shadow"
        >
          <Save className="w-4 h-4" />
          <span>Save to thresholds.json</span>
        </button>
      </div>

      {saveToast && (
        <div className="p-3 bg-emerald-950 border border-emerald-600 rounded-lg text-xs font-mono text-emerald-300 flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4" />
          <span>New threshold values and voter parameters published to edge runtime!</span>
        </div>
      )}

      {/* Safety Critical Risk Warning Banner */}
      <div className="p-4 bg-amber-950/80 border border-amber-600/80 rounded-xl text-xs font-mono text-amber-200 flex items-start gap-3 shadow-lg">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-amber-300">
            OPERATIONAL SENSITIVITY WARNING (CALIBRATION RULE):
          </div>
          <div>
            Lowering the <strong>Fire/Smoke threshold</strong> below 0.60 significantly increases false positive rates from yellow garments, boiler steam, and welding reflections.
            Raising the <strong>PPE threshold</strong> above 0.80 improves precision but increases missed compliance violations in low-light sectors.
          </div>
        </div>
      </div>

      {/* Main Configuration Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono text-xs">
        {/* Detection Confidence Thresholds */}
        <div className="p-5 bg-industrial-900 border border-industrial-800 rounded-xl space-y-5">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider pb-2 border-b border-industrial-800 flex items-center gap-2">
            <Flame className="w-4 h-4 text-red-500" />
            <span>Class Confidence Thresholds</span>
          </h3>

          {/* Fire Threshold */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-300 font-bold">Fire Detection:</span>
              <span className="text-red-400 font-bold bg-industrial-950 px-2 py-0.5 rounded border border-industrial-800">
                {(fireThreshold * 100).toFixed(0)}% ({fireThreshold})
              </span>
            </div>
            <input
              type="range"
              min={0.3}
              max={0.95}
              step={0.05}
              value={fireThreshold}
              onChange={(e) => setFireThreshold(parseFloat(e.target.value))}
              className="w-full accent-red-600"
            />
            <div className="flex justify-between text-3xs text-slate-500">
              <span>0.30 (High Recall / More False Alarms)</span>
              <span>0.95 (High Precision)</span>
            </div>
          </div>

          {/* Smoke Threshold */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-300 font-bold">Smoke Detection:</span>
              <span className="text-slate-200 font-bold bg-industrial-950 px-2 py-0.5 rounded border border-industrial-800">
                {(smokeThreshold * 100).toFixed(0)}% ({smokeThreshold})
              </span>
            </div>
            <input
              type="range"
              min={0.3}
              max={0.95}
              step={0.05}
              value={smokeThreshold}
              onChange={(e) => setSmokeThreshold(parseFloat(e.target.value))}
              className="w-full accent-slate-400"
            />
          </div>

          {/* Helmet Threshold */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-300 font-bold">Safety Helmet (vs. Bare Head):</span>
              <span className="text-sky-400 font-bold bg-industrial-950 px-2 py-0.5 rounded border border-industrial-800">
                {(helmetThreshold * 100).toFixed(0)}% ({helmetThreshold})
              </span>
            </div>
            <input
              type="range"
              min={0.4}
              max={0.95}
              step={0.05}
              value={helmetThreshold}
              onChange={(e) => setHelmetThreshold(parseFloat(e.target.value))}
              className="w-full accent-sky-500"
            />
          </div>

          {/* High-Vis Vest */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-300 font-bold">High-Visibility Vest:</span>
              <span className="text-amber-400 font-bold bg-industrial-950 px-2 py-0.5 rounded border border-industrial-800">
                {(vestThreshold * 100).toFixed(0)}% ({vestThreshold})
              </span>
            </div>
            <input
              type="range"
              min={0.4}
              max={0.95}
              step={0.05}
              value={vestThreshold}
              onChange={(e) => setVestThreshold(parseFloat(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>

          {/* Smoking in Restricted Zone */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-300 font-bold">Cigarette / Smoking Detection:</span>
              <span className="text-amber-300 font-bold bg-industrial-950 px-2 py-0.5 rounded border border-industrial-800">
                {(smokingThreshold * 100).toFixed(0)}% ({smokingThreshold})
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={0.95}
              step={0.05}
              value={smokingThreshold}
              onChange={(e) => setSmokingThreshold(parseFloat(e.target.value))}
              className="w-full accent-amber-400"
            />
          </div>
        </div>

        {/* Temporal Voting & Cooldown Configuration */}
        <div className="space-y-6">
          {/* Temporal Voting */}
          <div className="p-5 bg-industrial-900 border border-industrial-800 rounded-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider pb-2 border-b border-industrial-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Temporal Voting Rules (Per Stream)</span>
            </h3>

            {/* Fire Voting: 2/5 default */}
            <div className="p-3 bg-industrial-950 rounded border border-industrial-800 space-y-2">
              <div className="flex justify-between">
                <span className="font-bold text-red-400">Fire Hazard Voting Window:</span>
                <span className="text-white font-bold">{fireVoteReq} of {fireVoteWindow} frames</span>
              </div>
              <p className="text-3xs text-slate-400">
                Rapid life-safety reaction: Requires positive detection in {fireVoteReq} of the last {fireVoteWindow} consecutive frames.
              </p>
            </div>

            {/* PPE Voting: 8/10 default */}
            <div className="p-3 bg-industrial-950 rounded border border-industrial-800 space-y-2">
              <div className="flex justify-between">
                <span className="font-bold text-sky-400">PPE Violation Voting Window:</span>
                <span className="text-white font-bold">{ppeVoteReq} of {ppeVoteWindow} frames</span>
              </div>
              <p className="text-3xs text-slate-400">
                Anti-flicker suppression: Requires missing item in {ppeVoteReq} of the last {ppeVoteWindow} frames to eliminate worker motion blur false positives.
              </p>
            </div>
          </div>

          {/* Cooldown Suppression Window */}
          <div className="p-5 bg-industrial-900 border border-industrial-800 rounded-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider pb-2 border-b border-industrial-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>Deduplication & Cooldown Window</span>
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-bold">Alert Cooldown Window:</span>
                <span className="text-purple-400 font-bold bg-industrial-950 px-2 py-0.5 rounded border border-industrial-800">
                  {cooldownSec} seconds
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={cooldownSec}
                onChange={(e) => setCooldownSec(parseInt(e.target.value))}
                className="w-full accent-purple-500"
              />
              <p className="text-3xs text-slate-400">
                Repeated violations of identical (camera, type, item) are suppressed for {cooldownSec}s unless severity escalates to CRITICAL.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
