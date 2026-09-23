"use client";

import React from "react";
import Link from "next/link";
import { Sliders, Video, MapPin, ChevronRight, ShieldCheck, Cpu } from "lucide-react";

const ADMIN_CARDS = [
  {
    id: "cameras",
    title: "Camera Streams & Ingest",
    description: "Configure 4 optical camera streams, RTSP source URIs, resolution, and FPS telemetry decoders.",
    href: "/admin/cameras",
    icon: Video,
    metric: "4 Streams Active",
    badge: "RTSP / ONNX Ingest",
  },
  {
    id: "zones",
    title: "Factory Safety Zones",
    description: "Define 4 physical plant sectors (Loading Bay, Chemical Storage, Assembly, Furnace Hall) and sector hazard rules.",
    href: "/admin/zones",
    icon: MapPin,
    metric: "4 Sectors Monitored",
    badge: "Class 1 Div 2",
  },
  {
    id: "thresholds",
    title: "Confidence Thresholds & Voters",
    description: "Calibrate class confidence cutoffs (0.65 fire, 0.75 helmet) and temporal voting windows (2/5 fire, 8/10 PPE).",
    href: "/admin/thresholds",
    icon: Sliders,
    metric: "thresholds.json",
    badge: "ONNX INT8 Rules",
  },
];

export default function AdminLandingPage() {
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-bold font-display text-text-primary flex items-center gap-2.5">
          <Sliders className="w-6 h-6 text-copper" />
          <span>Admin & System Configuration</span>
        </h1>
        <p className="text-xs text-text-secondary font-mono mt-0.5">
          Manage edge node camera streams, sector mapping, and confidence threshold parameters
        </p>
      </div>

      {/* Admin Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {ADMIN_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.id}
              href={card.href}
              className="p-6 bg-surface hover:bg-elevated border border-border hover:border-copper rounded-sm flex flex-col justify-between transition-all group select-none"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-sm bg-copper/20 border border-copper flex items-center justify-center text-copper group-hover:scale-105 transition-transform">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-3xs font-mono px-2 py-0.5 rounded-sm bg-base border border-border text-text-secondary">
                    {card.badge}
                  </span>
                </div>

                <h3 className="text-base font-bold font-display text-text-primary group-hover:text-copper transition-colors mb-2">
                  {card.title}
                </h3>
                <p className="text-xs text-text-secondary font-mono leading-relaxed">
                  {card.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-2xs font-mono">
                <span className="text-text-primary font-bold">{card.metric}</span>
                <span className="text-copper font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Configure <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* System Status Footnote */}
      <div className="p-4 bg-surface border border-border rounded-sm flex items-center justify-between text-2xs font-mono text-text-secondary">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-copper" />
          <span>Config changes update local SQLite outbox and broadcast reload signals to ONNX runtime.</span>
        </div>
        <span className="text-slate-connect font-bold">ALL CONFIGS IN SYNC</span>
      </div>
    </div>
  );
}
