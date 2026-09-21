"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import { selectQueue } from "@/features/alerts/selectors";
import { DICTIONARY, SupportedLocale } from "@/lib/i18n";
import { AlarmController } from "./AlarmController";
import { MockDemoEngine } from "@/realtime/mockWsServer";
import {
  ShieldCheck,
  Video,
  Bell,
  FileText,
  BarChart3,
  Activity,
  Sliders,
  ChevronDown,
  Globe,
  Play,
  RotateCcw,
  Wifi,
  WifiOff,
  User,
  X,
} from "lucide-react";

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const byId = useAlertsStore((s) => s.byId);
  const conn = useAlertsStore((s) => s.conn);
  const locale = useAlertsStore((s) => s.locale);
  const setLocale = useAlertsStore((s) => s.setLocale);
  const demoNotice = useAlertsStore((s) => s.demoNotice);
  const setDemoNotice = useAlertsStore((s) => s.setDemoNotice);
  const t = DICTIONARY[locale];

  const activeQueue = selectQueue(byId);
  const openCount = activeQueue.filter((a) => a.status === "open").length;
  const criticalCount = activeQueue.filter(
    (a) => a.severity === "CRITICAL" && a.status === "open"
  ).length;

  const [timeStr, setTimeStr] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [demoMenuOpen, setDemoMenuOpen] = useState<boolean>(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState<boolean>(false);
  const [langMenuOpen, setLangMenuOpen] = useState<boolean>(false);
  const adminRef = useRef<HTMLDivElement>(null);
  const demoRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-IN", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setDateStr(
        now.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) setAdminMenuOpen(false);
      if (demoRef.current && !demoRef.current.contains(e.target as Node)) setDemoMenuOpen(false);
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isLive = conn === "live";

  const navLinks = [
    { href: "/wall", label: "Live Wall", icon: Video },
    {
      href: "/alerts",
      label: "Alert Queue",
      icon: Bell,
      badge: openCount > 0 ? openCount : undefined,
      critical: criticalCount > 0,
    },
    { href: "/history", label: "Audit History", icon: FileText },
    { href: "/reports", label: "Safety Analytics", icon: BarChart3 },
    { href: "/health", label: "Node Health", icon: Activity },
  ];

  const handleRunDemoStep = (index: number) => {
    MockDemoEngine.triggerStep(index);
    setDemoMenuOpen(false);
  };

  return (
    <header className="bg-nav-bg border-b border-nav-border shadow-lg shadow-black/40">
      {/* Demo Notification Toast */}
      {demoNotice && (
        <div className="bg-emerald-900/80 border-b border-emerald-700/50 px-4 py-1.5 text-xs text-emerald-200 flex items-center justify-between font-mono animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-300 font-bold">[DEMO]</span>
            <span>{demoNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setDemoNotice(null)}
            className="text-emerald-400 hover:text-white p-0.5 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-center h-[52px] px-4 gap-3">
        {/* ── Logo ── */}
        <Link href="/wall" className="flex items-center gap-2.5 shrink-0 mr-2 group">
          <div className="p-1.5 bg-blue-600/20 border border-blue-500/40 rounded-lg group-hover:border-blue-400/70 transition-colors">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
          </div>
          <div className="leading-tight">
            <div className="text-[11px] font-black tracking-[0.12em] uppercase text-white font-mono">
              Industrial Safety AI
            </div>
            <div className="text-[9px] font-medium tracking-[0.06em] text-slate-500 uppercase font-mono">
              Supervisor Dashboard
            </div>
          </div>
        </Link>

        {/* ── Vertical separator ── */}
        <div className="w-px h-6 bg-nav-border mx-1 shrink-0" />

        {/* ── Nav Links ── */}
        <nav aria-label="Main Navigation" className="hidden lg:flex items-center gap-0.5 flex-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== "/wall" && pathname.startsWith(link.href));
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all relative tracking-wide ${
                  isActive
                    ? "bg-nav-active text-white nav-active-glow border border-blue-600/40"
                    : "text-slate-400 hover:text-slate-100 hover:bg-nav-hover"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{link.label}</span>
                {link.badge !== undefined && (
                  <span
                    className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                      link.critical
                        ? "bg-red-500 text-white animate-pulse"
                        : "bg-slate-600 text-slate-200"
                    }`}
                  >
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Admin Dropdown */}
          <div className="relative" ref={adminRef}>
            <button
              type="button"
              onClick={() => setAdminMenuOpen(!adminMenuOpen)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all tracking-wide ${
                pathname.startsWith("/admin")
                  ? "bg-nav-active text-white border border-blue-600/40"
                  : "text-slate-400 hover:text-slate-100 hover:bg-nav-hover"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Admin</span>
              <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${adminMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {adminMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-52 bg-nav-bg border border-nav-border rounded-lg shadow-2xl py-1 z-50 animate-fade-in">
                <div className="px-3 py-1.5 text-3xs font-mono uppercase tracking-widest text-slate-600 border-b border-nav-border mb-1">
                  Configuration
                </div>
                {[
                  { href: "/admin/cameras", label: "Camera Config" },
                  { href: "/admin/zones/cam-01", label: "Zone Editor" },
                  { href: "/admin/thresholds", label: "Threshold Tuning" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setAdminMenuOpen(false)}
                    className="flex items-center px-3 py-2 text-[11px] text-slate-300 hover:bg-nav-hover hover:text-white transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Demo Scenarios */}
          <div className="relative ml-1" ref={demoRef}>
            <button
              type="button"
              onClick={() => setDemoMenuOpen(!demoMenuOpen)}
              className="px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-800/40 text-emerald-300 rounded-md text-[11px] font-semibold flex items-center gap-1.5 border border-emerald-700/30 hover:border-emerald-600/50 transition-all tracking-wide"
            >
              <Play className="w-3 h-3" />
              <span className="hidden xl:inline">Demo Scenarios</span>
              <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${demoMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {demoMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-80 bg-nav-bg border border-nav-border rounded-lg shadow-2xl py-1.5 z-50 animate-fade-in">
                <div className="px-3 py-1.5 text-3xs font-mono uppercase tracking-widest text-slate-600 border-b border-nav-border mb-1">
                  Live Demo Walkthrough
                </div>
                {[
                  { index: 0, label: "Missing Helmet (Sector 4)", color: "text-amber-300", desc: "Triggers compliance alert in queue" },
                  { index: 1, label: "Negative Corner Case", color: "text-emerald-400", desc: "Yellow shirt & cap stay silent (zero false alarm)" },
                  { index: 2, label: "Fire Hazard Breakout", color: "text-red-400", desc: "CRITICAL priority, siren audio, red border" },
                  { index: 3, label: "Smoking in Restricted Zone", color: "text-amber-400", desc: "Restricted polygon zone trigger" },
                ].map((step) => (
                  <button
                    key={step.index}
                    type="button"
                    onClick={() => handleRunDemoStep(step.index)}
                    className="w-full text-left px-3 py-2 hover:bg-nav-hover text-slate-200 flex flex-col transition-colors"
                  >
                    <span className={`font-bold text-[11px] ${step.color}`}>{step.index + 1}. {step.label}</span>
                    <span className="text-3xs text-slate-500 font-mono mt-0.5">{step.desc}</span>
                  </button>
                ))}
                <div className="my-1 border-t border-nav-border" />
                {[
                  { action: () => { MockDemoEngine.simulateDisconnect(); setDemoMenuOpen(false); }, icon: WifiOff, label: "Simulate Disconnect", color: "text-amber-300" },
                  { action: () => { MockDemoEngine.simulateReconnect(); setDemoMenuOpen(false); }, icon: Wifi, label: "Simulate Reconnect", color: "text-emerald-400" },
                  { action: () => { MockDemoEngine.reset(); setDemoMenuOpen(false); }, icon: RotateCcw, label: "Reset to Baseline", color: "text-slate-400" },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={item.action}
                      className={`w-full text-left px-3 py-1.5 hover:bg-nav-hover flex items-center gap-2 text-[11px] font-mono ${item.color} transition-colors`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* ── Right Controls ── */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {/* Alarm Controller (hidden label) */}
          <AlarmController />

          {/* Online Status Pill */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono tracking-wide border ${
              isLive
                ? "bg-emerald-900/30 border-emerald-700/50 text-emerald-300"
                : "bg-red-900/30 border-red-700/50 text-red-300"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isLive ? "bg-emerald-400 animate-pulse" : "bg-red-400"
              }`}
            />
            <span>{isLive ? "ONLINE" : conn === "reconnecting" ? "RECONNECTING" : "OFFLINE"}</span>
            {isLive && (
              <span className="text-emerald-500 font-normal opacity-70">· On-Prem (LAN)</span>
            )}
          </div>

          {/* Language Switcher */}
          <div className="relative" ref={langRef}>
            <button
              type="button"
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="flex items-center gap-1 px-2 py-1.5 bg-industrial-800/60 hover:bg-industrial-750 border border-industrial-700/60 rounded-md text-[11px] font-mono text-slate-300 hover:text-white transition-all"
            >
              <Globe className="w-3 h-3 text-slate-400" />
              <span className="uppercase font-bold">{locale}</span>
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
            {langMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-28 bg-nav-bg border border-nav-border rounded-lg shadow-2xl py-1 z-50 animate-fade-in">
                {(["en", "hi", "or"] as SupportedLocale[]).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => { setLocale(loc); setLangMenuOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] font-mono uppercase font-bold transition-colors ${
                      locale === loc
                        ? "text-blue-400 bg-blue-900/20"
                        : "text-slate-400 hover:text-white hover:bg-nav-hover"
                    }`}
                  >
                    {loc === "en" ? "English" : loc === "hi" ? "हिंदी" : "ଓଡ଼ିଆ"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SHIFT + Time */}
          <div className="hidden sm:flex flex-col items-end font-mono">
            <div className="text-[11px] font-bold text-slate-200 leading-none">{timeStr}</div>
            <div className="text-3xs text-slate-500 leading-none mt-0.5">SHIFT A · {dateStr}</div>
          </div>

          {/* User Avatar */}
          <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-300 hover:bg-blue-600/50 transition-colors cursor-pointer">
            <User className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </header>
  );
};
