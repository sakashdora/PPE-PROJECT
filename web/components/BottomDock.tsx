"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  AlertTriangle,
  BarChart3,
  Activity,
  Bot,
  Sliders,
} from "lucide-react";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import { selectQueue } from "@/features/alerts/selectors";

interface BottomDockProps {
  onOpenCopilot?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isAction?: boolean;
}

export const BottomDock: React.FC<BottomDockProps> = ({ onOpenCopilot }) => {
  const pathname = usePathname();
  const byId = useAlertsStore((s) => s.byId);
  const queue = selectQueue(byId);
  const unreadAlertsCount = queue.filter(
    (a) => a.status === "open" || a.status === "acknowledged"
  ).length;

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const items: NavItem[] = [
    {
      id: "wall",
      label: "Live Wall",
      description: "Live Wall — multi-camera neural grid & feeds",
      href: "/wall",
      icon: LayoutGrid,
    },
    {
      id: "alerts",
      label: "Alert Queue",
      description: "Alert Queue — live triage & CAS acknowledgment",
      href: "/alerts",
      icon: AlertTriangle,
    },
    {
      id: "reports",
      label: "Analytics",
      description: "Analytics — 7-day compliance & unit economics",
      href: "/reports",
      icon: BarChart3,
    },
    {
      id: "health",
      label: "Node Health",
      description: "Node Health — edge hardware & YOLO11s metrics",
      href: "/health",
      icon: Activity,
    },
    {
      id: "copilot",
      label: "Safety Copilot",
      description: "Copilot — deterministic safety intelligence engine",
      href: "/copilot",
      icon: Bot,
    },
    {
      id: "admin",
      label: "Admin",
      description: "Admin — confidence thresholds, zones & RTSP config",
      href: "/admin/thresholds",
      icon: Sliders,
    },
  ];

  return (
    <aside aria-label="Quick Navigation Dock" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 select-none">
      {/* Floating Dock Container (The single sanctioned blurred surface) */}
      <div className="forge-dock rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-2xl relative border border-border">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/wall"
              ? pathname === "/wall"
              : item.href === "/admin/thresholds"
              ? pathname.startsWith("/admin")
              : pathname.startsWith(item.href);

          const isAlerts = item.id === "alerts";
          const isHovered = hoveredItem === item.id;

          return (
            <div
              key={item.id}
              className="relative"
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              {/* Creative Tooltip Popup above dock on hover */}
              {isHovered && (
                <div
                  role="tooltip"
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 bg-surface border border-border rounded-sm shadow-xl pointer-events-none whitespace-nowrap z-50 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="text-2xs font-mono text-text-primary font-semibold">
                    {item.label}
                  </div>
                  <div className="text-[10px] font-mono text-text-secondary">
                    {item.description}
                  </div>
                  {/* Tooltip caret */}
                  <div className="w-1.5 h-1.5 bg-surface border-r border-b border-border rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2" />
                </div>
              )}

              {/* Navigation Link / Button */}
              <Link
                href={item.href}
                className={`relative p-2.5 rounded-full flex flex-col items-center justify-center transition-all duration-150 group ${
                  isActive
                    ? "text-copper bg-surface/80"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface/50"
                }`}
                aria-label={item.label}
              >
                {/* Icon with subtle lift on hover */}
                <div className="transition-transform duration-150 group-hover:-translate-y-0.5">
                  <Icon className="w-4 h-4" />
                </div>

                {/* Persistent Numeric Badge for Unread Alerts (NON-NEGOTIABLE SAFETY REQUIREMENT) */}
                {isAlerts && unreadAlertsCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-critical border border-border text-[9px] font-mono font-bold text-white flex items-center justify-center animate-pulse"
                    title={`${unreadAlertsCount} unread active alerts`}
                  >
                    {unreadAlertsCount}
                  </span>
                )}

                {/* Active Indicator: Persistent Signal Copper underline dot */}
                {isActive && (
                  <span className="w-1.5 h-0.5 bg-copper rounded-full mt-0.5" />
                )}
                {!isActive && (
                  <span className="w-1.5 h-0.5 bg-transparent mt-0.5" />
                )}
              </Link>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
