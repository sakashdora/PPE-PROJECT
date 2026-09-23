"use client";

import React, { useState } from "react";
import { Settings, Volume2, VolumeX, Globe, Bell, Wifi, Server, CheckCircle, Save } from "lucide-react";
import { useAlertsStore } from "@/features/alerts/alerts.store";

export default function SettingsPage() {
  const locale = useAlertsStore((s) => s.locale);
  const setLocale = useAlertsStore((s) => s.setLocale);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [apiUrl, setApiUrl] = useState("http://localhost:4000");
  const [saveToast, setSaveToast] = useState(false);

  const handleSave = () => {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold font-display text-text-primary flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-copper" />
            <span>System Preferences & Audio Settings</span>
          </h1>
          <p className="text-xs text-text-secondary font-mono mt-0.5">
            Configure physical siren volume, language dictionary, WebSocket auto-reconnect, and API endpoints
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 bg-copper hover:bg-copper-hover text-base rounded-sm text-xs font-mono font-bold flex items-center gap-2 transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>Save Settings</span>
        </button>
      </div>

      {saveToast && (
        <div className="p-3 bg-safe-bg border border-safe rounded-sm text-xs font-mono text-safe flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-safe" />
          <span>Preferences updated and persisted to local state!</span>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
        {/* Audio & Siren Controller */}
        <div className="p-5 bg-surface border border-border rounded-sm space-y-4">
          <h3 className="text-sm font-bold font-display text-text-primary uppercase tracking-wider pb-2 border-b border-border flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-copper" />
            <span>Audio & Physical Siren Alarm</span>
          </h3>

          <div className="flex items-center justify-between p-3 bg-base border border-border rounded-sm">
            <div>
              <div className="font-bold text-text-primary">Enable Physical Siren Output</div>
              <div className="text-2xs text-text-secondary mt-0.5">
                Play synthesized 880Hz / 440Hz dual-tone siren on P0 Critical Fire alerts
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-3 py-1.5 rounded-sm font-bold text-2xs transition-colors border ${
                soundEnabled ? "bg-brand-accent text-white border-brand-accent" : "bg-surface border-border text-text-secondary hover:text-text-primary"
              }`}
            >
              {soundEnabled ? "ENABLED" : "MUTED"}
            </button>
          </div>

          {/* Language Selector */}
          <div className="p-3 bg-base border border-border rounded-sm space-y-2">
            <div className="flex items-center gap-2 font-bold text-text-primary">
              <Globe className="w-4 h-4 text-copper" />
              <span>Operator Language Dictionary:</span>
            </div>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as "en" | "hi" | "or")}
              className="w-full p-2 bg-surface border border-border rounded-sm text-text-primary text-xs focus:outline-none focus:border-copper"
            >
              <option value="en">English (US / IN Standard)</option>
              <option value="hi">हिंदी (Hindi Operator)</option>
              <option value="or">ଓଡ଼ିଆ (Odia Localized)</option>
            </select>
          </div>
        </div>

        {/* Network & Edge API Config */}
        <div className="p-5 bg-surface border border-border rounded-sm space-y-4">
          <h3 className="text-sm font-bold font-display text-text-primary uppercase tracking-wider pb-2 border-b border-border flex items-center gap-2">
            <Server className="w-4 h-4 text-copper" />
            <span>Edge Network & Telemetry Relay</span>
          </h3>

          <div className="flex items-center justify-between p-3 bg-base border border-border rounded-sm">
            <div>
              <div className="font-bold text-text-primary">WebSocket Auto-Reconnect</div>
              <div className="text-2xs text-text-secondary mt-0.5">
                Automatically retry WebSocket connection with exponential backoff on LAN disconnect
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAutoReconnect(!autoReconnect)}
              className={`px-3 py-1.5 rounded-sm font-bold text-2xs transition-colors border ${
                autoReconnect ? "bg-brand-accent text-white border-brand-accent" : "bg-surface border-border text-text-secondary hover:text-text-primary"
              }`}
            >
              {autoReconnect ? "ACTIVE" : "OFF"}
            </button>
          </div>

          <div className="p-3 bg-base border border-border rounded-sm space-y-2">
            <label className="block text-text-primary font-bold">Edge REST Service Base URL:</label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full p-2 bg-surface border border-border rounded-sm text-text-primary text-xs focus:outline-none focus:border-copper"
            />
            <div className="text-3xs text-text-secondary">
              Default NestJS gateway: http://localhost:4000
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
