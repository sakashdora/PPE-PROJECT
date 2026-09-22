"use client";

import React, { useEffect, useState } from "react";

interface GaugeDialProps {
  label: string;
  value: number;
  max: number;
  unit: string;
  subtext?: string;
  color?: "copper" | "jade" | "safe" | "warning" | "critical" | "neutral";
  size?: number;
}

export const GaugeDial: React.FC<GaugeDialProps> = ({
  label,
  value,
  max,
  unit,
  subtext,
  color = "copper",
  size = 140,
}) => {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(value);
    }, 100);
    return () => clearTimeout(timer);
  }, [value]);

  const strokeWidth = 8;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  // Arc angle: 260 degrees (leaving 100 degrees open at the bottom)
  const arcLength = circumference * (260 / 360);
  const percent = Math.min(Math.max(animatedValue / max, 0), 1);
  const strokeDashoffset = arcLength - percent * arcLength;

  const colorMap = {
    copper: {
      stroke: "#C6752B",
      text: "text-copper",
    },
    jade: {
      stroke: "#1B8A5A",
      text: "text-jade",
    },
    safe: {
      stroke: "#3E8E5A",
      text: "text-safe",
    },
    warning: {
      stroke: "#F2760C",
      text: "text-warning",
    },
    critical: {
      stroke: "#C1272D",
      text: "text-critical",
    },
    neutral: {
      stroke: "#7A7368",
      text: "text-neutral",
    },
  };

  const selected = colorMap[color] || colorMap.copper;

  return (
    <div className="flex flex-col items-center justify-center p-3 font-mono">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-[220deg]"
        >
          {/* Background Track Arc (Border Hairline) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#3A332A"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />

          {/* Active Value Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={selected.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center -translate-y-1">
          <span className={`text-2xl font-bold font-display tracking-tight ${selected.text}`}>
            {typeof value === "number" && value % 1 !== 0 ? value.toFixed(1) : value}
            <span className="text-xs font-normal text-text-secondary ml-0.5">{unit}</span>
          </span>
          <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold mt-0.5">
            {label}
          </span>
        </div>
      </div>

      {subtext && (
        <span className="text-[10px] text-text-secondary text-center mt-1 max-w-[160px] leading-tight">
          {subtext}
        </span>
      )}
    </div>
  );
};
