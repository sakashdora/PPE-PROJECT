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
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight flex items-center gap-2.5 font-display">
            <Sliders className="w-6 h-6 text-copper" />
            <span>Thresholds & Temporal Voter Tuning</span>
          </h1>
          <p className="text-xs text-text-secondary font-mono mt-0.5">
            Load and tune empirical detection thresholds and multi-frame voting rules (thresholds.json)
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 bg-copper hover:bg-copper-hover text-base rounded-sm text-xs font-mono font-bold flex items-center gap-2 transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>Save to thresholds.json</span>
        </button>
      </div>

      {saveToast && (
        <div className="p-3 bg-jade/20 border border-jade rounded-sm text-xs font-mono text-jade flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>New threshold values and voter parameters published to edge runtime!</span>
        </div>
      )}

      {/* Safety Critical Risk Warning Banner */}
      <div className="p-4 bg-warning/15 border border-warning rounded-sm text-xs font-mono text-text-primary flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-warning uppercase">
            OPERATIONAL CALIBRATION ADVISORY:
          </div>
          <div className="text-text-secondary">
            Lowering the <strong className="text-text-primary">Fire/Smoke threshold</strong> below 0.60 significantly increases false positive rates from yellow garments, boiler steam, and welding reflections.
            Raising the <strong className="text-text-primary">PPE threshold</strong> above 0.80 improves precision but increases missed compliance violations in low-light sectors.
          </div>
        </div>
      </div>

      {/* Main Configuration Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono text-xs">
        {/* Detection Confidence Thresholds */}
        <div className="p-5 bg-surface border border-border rounded-sm space-y-5">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider pb-2 border-b border-border flex items-center gap-2 font-display">
            <Flame className="w-4 h-4 text-critical" />
            <span>Class Confidence Thresholds</span>
          </h3>

          {/* Fire Threshold */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-text-primary font-bold">Fire Detection:</span>
              <span className="text-critical font-bold bg-base px-2 py-0.5 rounded-sm border border-critical">
                {(fireThreshold * 100).toFixed(0)}% ({fireThreshold})
              </span>
            </div>
            <input
              type="range"
              min="0.4"
              max="0.95"
              step="0.05"
              value={fireThreshold}
              onChange={(e) => setFireThreshold(parseFloat(e.target.value))}
              className="w-full accent-[#C1272D] bg-base h-2 rounded-sm cursor-pointer"
            />
          </div>

          {/* Smoke Threshold */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-text-primary font-bold">Smoke Detection:</span>
              <span className="text-critical font-bold bg-base px-2 py-0.5 rounded-sm border border-critical">
                {(smokeThreshold * 100).toFixed(0)}% ({smokeThreshold})
              </span>
            </div>
            <input
              type="range"
              min="0.4"
              max="0.95"
              step="0.05"
              value={smokeThreshold}
              onChange={(e) => setSmokeThreshold(parseFloat(e.target.value))}
              className="w-full accent-[#C1272D] bg-base h-2 rounded-sm cursor-pointer"
            />
          </div>

          {/* Helmet Threshold */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-text-primary font-bold">Hardhat / Helmet Detection:</span>
              <span className="text-copper font-bold bg-base px-2 py-0.5 rounded-sm border border-copper">
                {(helmetThreshold * 100).toFixed(0)}% ({helmetThreshold})
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={helmetThreshold}
              onChange={(e) => setHelmetThreshold(parseFloat(e.target.value))}
              className="w-full accent-[#C6752B] bg-base h-2 rounded-sm cursor-pointer"
            />
          </div>

          {/* High-Vis Vest */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-text-primary font-bold">High-Vis Vest Detection:</span>
              <span className="text-copper font-bold bg-base px-2 py-0.5 rounded-sm border border-copper">
                {(vestThreshold * 100).toFixed(0)}% ({vestThreshold})
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={vestThreshold}
              onChange={(e) => setVestThreshold(parseFloat(e.target.value))}
              className="w-full accent-[#C6752B] bg-base h-2 rounded-sm cursor-pointer"
            />
          </div>

          {/* Smoking in Restricted Zone */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-text-primary font-bold">Smoking / Ignition Detection:</span>
              <span className="text-warning font-bold bg-base px-2 py-0.5 rounded-sm border border-warning">
                {(smokingThreshold * 100).toFixed(0)}% ({smokingThreshold})
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={smokingThreshold}
              onChange={(e) => setSmokingThreshold(parseFloat(e.target.value))}
              className="w-full accent-[#F2760C] bg-base h-2 rounded-sm cursor-pointer"
            />
          </div>
        </div>

        {/* Temporal Voting & Alarm Suppression Rules */}
        <div className="p-5 bg-surface border border-border rounded-sm space-y-5">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider pb-2 border-b border-border flex items-center gap-2 font-display">
            <Layers className="w-4 h-4 text-copper" />
            <span>Temporal Voting & Sliding Window Rules</span>
          </h3>

          {/* Fire/Smoke Temporal Rules */}
          <div className="p-4 bg-base border border-border rounded-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-critical font-bold flex items-center gap-1.5">
                <Flame className="w-4 h-4" />
                <span>Fire / Thermal Rule:</span>
              </span>
              <span className="text-xs text-text-primary font-bold">
                {fireVoteReq} of {fireVoteWindow} frames
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-text-secondary block mb-1">Window Size (Frames):</label>
                <input
                  type="number"
                  min="2"
                  max="15"
                  value={fireVoteWindow}
                  onChange={(e) => setFireVoteWindow(parseInt(e.target.value) || 5)}
                  className="w-full px-2.5 py-1 bg-surface border border-border rounded-sm text-text-primary focus:outline-none focus:border-copper"
                />
              </div>
              <div>
                <label className="text-[10px] text-text-secondary block mb-1">Votes Required:</label>
                <input
                  type="number"
                  min="1"
                  max={fireVoteWindow}
                  value={fireVoteReq}
                  onChange={(e) => setFireVoteReq(parseInt(e.target.value) || 2)}
                  className="w-full px-2.5 py-1 bg-surface border border-border rounded-sm text-text-primary focus:outline-none focus:border-copper"
                />
              </div>
            </div>
            <p className="text-[10px] text-text-secondary leading-tight">
              Low voting threshold minimizes physical siren trigger latency (&lt; 150ms) for high-stakes fire hazards.
            </p>
          </div>

          {/* PPE Temporal Rules */}
          <div className="p-4 bg-base border border-border rounded-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-copper font-bold flex items-center gap-1.5">
                <HardHat className="w-4 h-4" />
                <span>Missing PPE Rule:</span>
              </span>
              <span className="text-xs text-text-primary font-bold">
                {ppeVoteReq} of {ppeVoteWindow} frames
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-text-secondary block mb-1">Window Size (Frames):</label>
                <input
                  type="number"
                  min="5"
                  max="30"
                  value={ppeVoteWindow}
                  onChange={(e) => setPpeVoteWindow(parseInt(e.target.value) || 10)}
                  className="w-full px-2.5 py-1 bg-surface border border-border rounded-sm text-text-primary focus:outline-none focus:border-copper"
                />
              </div>
              <div>
                <label className="text-[10px] text-text-secondary block mb-1">Votes Required:</label>
                <input
                  type="number"
                  min="3"
                  max={ppeVoteWindow}
                  value={ppeVoteReq}
                  onChange={(e) => setPpeVoteReq(parseInt(e.target.value) || 8)}
                  className="w-full px-2.5 py-1 bg-surface border border-border rounded-sm text-text-primary focus:outline-none focus:border-copper"
                />
              </div>
            </div>
            <p className="text-[10px] text-text-secondary leading-tight">
              High voting threshold suppresses temporary occlusion (e.g. worker turning head or reaching behind equipment).
            </p>
          </div>

          {/* Cooldown Period */}
          <div className="p-4 bg-base border border-border rounded-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-text-primary font-bold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-copper" />
                <span>Alert Cooldown / Debounce:</span>
              </span>
              <span className="text-xs text-copper font-bold">{cooldownSec} Seconds</span>
            </div>
            <input
              type="range"
              min="5"
              max="120"
              step="5"
              value={cooldownSec}
              onChange={(e) => setCooldownSec(parseInt(e.target.value))}
              className="w-full accent-[#C6752B] bg-surface h-2 rounded-sm cursor-pointer"
            />
            <p className="text-[10px] text-text-secondary leading-tight">
              Suppresses duplicate alarm incidents from identical sector cameras within the cooldown window.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
