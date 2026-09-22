"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import { selectQueue } from "@/features/alerts/selectors";
import { DICTIONARY, SupportedLocale } from "@/lib/i18n";
import { MockDemoEngine } from "@/realtime/mockWsServer";
import { ArgusEyeLogo } from "./ArgusEyeLogo";
import {
  Video,
  Bell,
  FileText,
  BarChart3,
  Activity,
  Sliders,
  ChevronDown,
  Globe,
  Play,
  Bot,
  User,
  X,
  Sparkles,
} from "lucide-react";

export const Navbar: React.FC<{ onOpenCopilot?: () => void }> = ({ onOpenCopilot }) => {
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
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdowns on click outside
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
    { href: "/reports", label: "Safety Analytics", icon: BarChart3 },
    { href: "/health", label: "Node Health", icon: Activity },
    { href: "/history", label: "Audit Logs", icon: FileText },
  ];

  const handleRunDemoStep = (index: number) => {
    MockDemoEngine.triggerStep(index);
    setDemoMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-depth">
      {/* Demo Notification Banner - Updated to fit Mission Control Strict Colors */}
      {demoNotice && (
        <div className="bg-safe-dark border-b border-safe px-4 py-1.5 text-xs text-text-primary flex items-center justify-between font-mono-data">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-none bg-safe" />
            <span className="font-bold text-safe-light">[DEMO TRIGGER]</span>
            <span>{demoNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setDemoNotice(null)}
            className="text-safe hover:text-white p-0.5 rounded-sm transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between h-[56px] px-4 sm:px-6 gap-3">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-4">
          <Link href="/" className="group flex items-center gap-2">
            {/* Logo could be updated, assuming it will inherit font-display from its internal implementation */}
            <ArgusEyeLogo size={32} showText={true} subtitle="Mission Control" />
          </Link>

          <div className="hidden xl:block w-px h-6 bg-depth mx-1" />

          {/* Navigation Links with Tactical Underline */}
          <nav aria-label="Main Navigation" className="hidden lg:flex items-center gap-1 relative h-full">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href || (link.href !== "/wall" && pathname.startsWith(link.href));
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3.5 py-1.5 rounded-sm text-xs font-display font-medium flex items-center gap-2 transition-colors h-full ${
                    isActive
                      ? "text-text-primary bg-elevated/50"
                      : "text-text-secondary hover:text-text-primary hover:bg-elevated/30"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-nominal" : "text-text-secondary"}`} />
                  <span>{link.label}</span>

                  {link.badge !== undefined && (
                    <span
                      className={`text-[10px] font-mono-data font-bold px-1.5 py-0.5 rounded-sm leading-none ${
                        link.critical
                          ? "bg-critical-dark text-text-primary border border-critical"
                          : "bg-depth text-text-secondary"
                      }`}
                    >
                      {link.badge}
                    </span>
                  )}

                  {/* Tactical Active Underline (No Spring, Linear) */}
                  {isActive && (
                    <motion.div
                      layoutId="nav-active-underline"
                      className="absolute bottom-[-10px] left-0 right-0 h-[2px] bg-nominal"
                      transition={{ duration: 0.1, ease: "linear" }}
                    />
                  )}
                </Link>
              );
            })}

            {/* Admin Menu */}
            <div className="relative h-full flex items-center" ref={adminRef}>
              <button
                type="button"
                onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                className={`px-3 py-1.5 rounded-sm text-xs font-display font-medium flex items-center gap-1.5 transition-colors ${
                  pathname.startsWith("/admin")
                    ? "text-text-primary bg-elevated/50"
                    : "text-text-secondary hover:text-text-primary hover:bg-elevated/30"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Admin</span>
                <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${adminMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {adminMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-52 bg-elevated border border-depth rounded-sm py-1.5 z-50 shadow-md">
                  <div className="px-3.5 py-1 text-3xs font-mono-data uppercase tracking-widest text-telemetry border-b border-depth mb-1">
                    System Configuration
                  </div>
                  {[
                    { href: "/admin/cameras", label: "Optical Sensors" },
                    { href: "/admin/zones/cam-01", label: "Polygon Zones" },
                    { href: "/admin/thresholds", label: "Voter Tuning" },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setAdminMenuOpen(false)}
                      className="flex items-center px-3.5 py-2 text-xs font-display text-text-primary hover:bg-nominal-bg hover:text-nominal transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Right: Actions, Copilot & Status Controls */}
        <div className="flex items-center gap-2.5">
          {/* Ask ARGUS Safety Copilot CTA - Redesigned to be Tactical */}
          <Link
            href="/copilot"
            className="group relative px-3 py-1.5 rounded-sm text-xs font-mono-data font-medium flex items-center gap-2 bg-canvas border border-depth text-text-primary hover:border-nominal transition-colors"
          >
            <Bot className="w-4 h-4 text-nominal" />
            <span className="tracking-wide">Ask ARGUS</span>
          </Link>

          {/* Demo Walkthrough Scenarios */}
          <div className="relative" ref={demoRef}>
            <button
              type="button"
              onClick={() => setDemoMenuOpen(!demoMenuOpen)}
              className="px-3 py-1.5 bg-canvas hover:bg-elevated text-text-primary rounded-sm text-xs font-mono-data font-medium flex items-center gap-1.5 border border-depth transition-colors"
            >
              <Play className="w-3 h-3 text-safe" />
              <span className="hidden sm:inline">Scenarios</span>
              <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${demoMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {demoMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-elevated border border-depth rounded-sm p-2 z-50 shadow-md">
                <div className="px-3 py-1 text-3xs font-mono-data uppercase tracking-widest text-telemetry border-b border-depth mb-1.5">
                  Simulation Profiles
                </div>
                {[
                  { index: 0, label: "Missing Helmet (Sector 4)", color: "text-compliance", badge: "COMPLIANCE", desc: "Temporal voting (8/10 frames)" },
                  { index: 1, label: "Yellow Shirt / Cap", color: "text-safe", badge: "0.0% FPR", desc: "Hard-negatives suppression" },
                  { index: 2, label: "Fire Hazard Breakout", color: "text-critical", badge: "CRITICAL", desc: "Dual-rate (2/5 frames) + Alarm" },
                  { index: 3, label: "Smoking in Restricted Zone", color: "text-warning", badge: "ZONE VIOLATION", desc: "Polygon restriction breach" },
                ].map((step) => (
                  <button
                    key={step.index}
                    type="button"
                    onClick={() => handleRunDemoStep(step.index)}
                    className="w-full text-left p-2 rounded-sm hover:bg-canvas border border-transparent hover:border-depth transition-colors group flex flex-col gap-1 mb-1"
                  >
                    <div className="flex items-center justify-between text-xs font-mono-data font-medium">
                      <span className={`${step.color}`}>{step.label}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-depth text-text-primary border border-depth">
                        {step.badge}
                      </span>
                    </div>
                    <div className="text-3xs text-telemetry font-mono-data">{step.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Telemetry Status Pill - Density updated */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-sm bg-canvas border border-depth font-mono-data text-2xs text-text-primary">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-none ${isLive ? "bg-safe" : "bg-critical"}`} />
              <span className="font-medium text-text-primary">{isLive ? "ONLINE" : "RECONNECTING"}</span>
            </span>
            <span className="text-depth">|</span>
            <span className="text-nominal font-medium">14ms</span>
            <span className="text-depth">|</span>
            <span className="text-telemetry">{timeStr}</span>
          </div>

          {/* Language Selector */}
          <div className="relative" ref={langRef}>
            <button
              type="button"
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="p-1.5 rounded-sm border border-transparent hover:border-depth hover:bg-canvas text-text-secondary hover:text-text-primary transition-colors"
              title="Change Language"
            >
              <Globe className="w-4 h-4" />
            </button>
            {langMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-32 bg-elevated border border-depth rounded-sm py-1 z-50 shadow-md">
                {[
                  { code: "en", label: "English" },
                  { code: "hi", label: "हिंदी (Hindi)" },
                  { code: "or", label: "ଓଡ଼ିଆ (Odia)" },
                ].map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setLocale(item.code as SupportedLocale);
                      setLangMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-mono-data transition-colors ${
                      locale === item.code ? "text-nominal font-medium bg-nominal-bg" : "text-text-primary hover:bg-canvas"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User Persona Link */}
          <Link
            href="/login"
            className="flex items-center gap-1.5 p-1 sm:px-2 rounded-sm text-text-primary hover:bg-canvas border border-transparent hover:border-depth transition-colors text-xs font-mono-data"
            title="Shift Supervisor"
          >
            <div className="w-5 h-5 rounded-sm bg-depth flex items-center justify-center text-text-primary font-medium text-[10px]">
              S
            </div>
            <span className="hidden md:inline">Supervisor</span>
          </Link>
        </div>
      </div>
    </header>
  );
};
