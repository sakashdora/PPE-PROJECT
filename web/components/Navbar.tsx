"use client";

import React, { useState, useEffect } from "react";
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
  AlertTriangle,
  FileText,
  BarChart3,
  Sliders,
  Activity,
  ChevronDown,
  Globe,
  Play,
  RotateCcw,
  Wifi,
  WifiOff,
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
  const [demoMenuOpen, setDemoMenuOpen] = useState<boolean>(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState<boolean>(false);

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
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navLinks = [
    { href: "/wall", label: t.liveWall, icon: Video },
    {
      href: "/alerts",
      label: t.alertQueue,
      icon: AlertTriangle,
      badge: openCount > 0 ? openCount : undefined,
      critical: criticalCount > 0,
    },
    { href: "/history", label: t.history, icon: FileText },
    { href: "/reports", label: t.reports, icon: BarChart3 },
    { href: "/health", label: t.health, icon: Activity },
  ];

  const handleRunDemoStep = (index: number) => {
    MockDemoEngine.triggerStep(index);
    setDemoMenuOpen(false);
  };

  return (
    <header className="border-b border-industrial-800 bg-industrial-950/95 backdrop-blur sticky top-0 z-40">
      {/* Demo Notification Toast if set */}
      {demoNotice && (
        <div className="bg-industrial-800/90 border-b border-industrial-600 px-4 py-1.5 text-xs text-industrial-200 flex items-center justify-between font-mono animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-emerald-300 font-bold">[DEMO EVENT]:</span>
            <span>{demoNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setDemoNotice(null)}
            className="text-slate-400 hover:text-white text-xs px-2"
          >
            ✕
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and System Health Badge */}
          <div className="flex items-center gap-6">
            <Link href="/wall" className="flex items-center gap-2.5 group">
              <div className="p-2 bg-red-600/20 border border-red-500/40 rounded-lg group-hover:border-red-400 transition-colors">
                <ShieldCheck className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm tracking-wider uppercase text-white font-mono">
                    FACTORY SAFETY AI
                  </span>
                  <span className="text-3xs font-mono px-1.5 py-0.5 rounded bg-industrial-800 text-slate-300 border border-industrial-700">
                    PS06
                  </span>
                </div>
                <div className="flex items-center gap-2 text-2xs text-slate-400 font-mono">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      conn === "live" ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                    }`}
                  />
                  <span>
                    {conn === "live" ? "ON-PREM EDGE ACTIVE" : "OFFLINE CACHE"}
                  </span>
                </div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav aria-label="Main Navigation" className="hidden lg:flex items-center gap-1 ml-4">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-2 transition-all ${
                      isActive
                        ? "bg-industrial-800 text-white border border-industrial-600 shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-industrial-900"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{link.label}</span>
                    {link.badge !== undefined && (
                      <span
                        className={`text-2xs font-mono px-1.5 py-0.2 rounded-full font-bold ${
                          link.critical
                            ? "bg-red-600 text-white animate-pulse"
                            : "bg-industrial-700 text-slate-200"
                        }`}
                      >
                        {link.badge}
                      </span>
                    )}
                  </Link>
                );
              })}

              {/* Admin Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    pathname.startsWith("/admin")
                      ? "bg-industrial-800 text-white border border-industrial-600"
                      : "text-slate-400 hover:text-white hover:bg-industrial-900"
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Admin</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>

                {adminMenuOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 mt-2 w-48 bg-industrial-900 border border-industrial-700 rounded shadow-xl py-1 z-50 font-mono text-xs"
                  >
                    <Link
                      href="/admin/cameras"
                      onClick={() => setAdminMenuOpen(false)}
                      className="block px-4 py-2 text-slate-300 hover:bg-industrial-800 hover:text-white"
                    >
                      {t.cameras} Config
                    </Link>
                    <Link
                      href="/admin/zones/cam-01"
                      onClick={() => setAdminMenuOpen(false)}
                      className="block px-4 py-2 text-slate-300 hover:bg-industrial-800 hover:text-white"
                    >
                      SVG {t.zones} Editor
                    </Link>
                    <Link
                      href="/admin/thresholds"
                      onClick={() => setAdminMenuOpen(false)}
                      className="block px-4 py-2 text-slate-300 hover:bg-industrial-800 hover:text-white"
                    >
                      {t.thresholds} Tuning
                    </Link>
                  </div>
                )}
              </div>
            </nav>
          </div>

          {/* Right-Hand Utility Controls */}
          <div className="flex items-center gap-3">
            {/* Alarm Audio Controller */}
            <AlarmController />

            {/* Quick Demo Scenario Trigger Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDemoMenuOpen(!demoMenuOpen)}
                className="px-2.5 py-1.5 bg-industrial-800 hover:bg-industrial-700 text-slate-200 rounded text-xs font-mono flex items-center gap-1.5 border border-industrial-700 shadow-sm"
              >
                <Play className="w-3 h-3 text-emerald-400" />
                <span className="hidden sm:inline">Demo Scenarios</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {demoMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-72 bg-industrial-900 border border-industrial-700 rounded-lg shadow-2xl py-2 z-50 text-xs"
                >
                  <div className="px-3 py-1 font-mono text-3xs uppercase tracking-wider text-slate-400 border-b border-industrial-800">
                    Live Demo Walkthrough Steps
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRunDemoStep(0)}
                    className="w-full text-left px-3 py-2 hover:bg-industrial-800 text-slate-200 flex flex-col"
                  >
                    <span className="font-bold text-amber-300">1. Missing Helmet (Sector 4)</span>
                    <span className="text-3xs text-slate-400 font-mono">Triggers compliance alert in queue</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunDemoStep(1)}
                    className="w-full text-left px-3 py-2 hover:bg-industrial-800 text-slate-200 flex flex-col"
                  >
                    <span className="font-bold text-emerald-400">2. Negative Corner Case</span>
                    <span className="text-3xs text-slate-400 font-mono">Yellow shirt & cap stay silent (zero false alarm)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunDemoStep(2)}
                    className="w-full text-left px-3 py-2 hover:bg-industrial-800 text-slate-200 flex flex-col"
                  >
                    <span className="font-bold text-red-400">3. Fire Hazard Breakout</span>
                    <span className="text-3xs text-slate-400 font-mono">CRITICAL priority, siren audio, red border</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunDemoStep(3)}
                    className="w-full text-left px-3 py-2 hover:bg-industrial-800 text-slate-200 flex flex-col"
                  >
                    <span className="font-bold text-amber-400">4. Smoking in Restricted Zone</span>
                    <span className="text-3xs text-slate-400 font-mono">Restricted polygon zone trigger</span>
                  </button>

                  <div className="my-1 border-t border-industrial-800" />

                  <button
                    type="button"
                    onClick={() => {
                      MockDemoEngine.simulateDisconnect();
                      setDemoMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-industrial-800 text-amber-300 flex items-center gap-2 font-mono"
                  >
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>Simulate Disconnect</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      MockDemoEngine.simulateReconnect();
                      setDemoMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-industrial-800 text-emerald-400 flex items-center gap-2 font-mono"
                  >
                    <Wifi className="w-3.5 h-3.5" />
                    <span>Simulate Reconnect</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      MockDemoEngine.reset();
                      setDemoMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-industrial-800 text-slate-400 flex items-center gap-2 font-mono"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset to Baseline</span>
                  </button>
                </div>
              )}
            </div>

            {/* Language Switcher */}
            <div className="flex items-center gap-1 bg-industrial-900 border border-industrial-800 rounded px-1.5 py-1 text-xs font-mono">
              <Globe className="w-3 h-3 text-slate-400" />
              {(["en", "hi", "or"] as SupportedLocale[]).map((loc) => (
                <button
                  type="button"
                  key={loc}
                  onClick={() => setLocale(loc)}
                  className={`px-1.5 py-0.5 rounded text-3xs uppercase font-bold transition-all ${
                    locale === loc
                      ? "bg-red-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>

            {/* Live Clock */}
            <div className="hidden sm:block text-right font-mono">
              <div className="text-xs font-bold text-slate-200">{timeStr}</div>
              <div className="text-3xs text-slate-400">SHIFT A · IST</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
