"use client";

import React from "react";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import { audioController } from "@/lib/audio";
import { DICTIONARY } from "@/lib/i18n";
import { Volume2, VolumeX, ShieldAlert, Check } from "lucide-react";

export const AlarmController: React.FC = () => {
  const audioUnlocked = useAlertsStore((s) => s.audioUnlocked);
  const setAudioUnlocked = useAlertsStore((s) => s.setAudioUnlocked);
  const locale = useAlertsStore((s) => s.locale);
  const t = DICTIONARY[locale];

  if (audioUnlocked) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/60 border border-emerald-600/60 text-emerald-400 rounded-full text-xs font-mono">
        <Volume2 className="w-3.5 h-3.5 animate-pulse" />
        <span className="hidden md:inline font-medium">SIREN ARMED</span>
        <button
          type="button"
          onClick={() => audioController.playAckChime()}
          title="Test Chime"
          className="ml-1 px-1.5 py-0.5 bg-emerald-800/40 hover:bg-emerald-700/60 text-white rounded text-2xs transition-colors"
        >
          Test
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => setAudioUnlocked(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded shadow-lg transition-all transform hover:scale-105 active:scale-95 animate-pulse"
      >
        <VolumeX className="w-4 h-4 text-black" />
        <span>{t.clickToEnableAudio}</span>
      </button>
    </div>
  );
};

export const AudioUnlockGateModal: React.FC = () => {
  const audioUnlocked = useAlertsStore((s) => s.audioUnlocked);
  const setAudioUnlocked = useAlertsStore((s) => s.setAudioUnlocked);
  const locale = useAlertsStore((s) => s.locale);
  const t = DICTIONARY[locale];

  if (audioUnlocked) return null;

  return (
    <div className="bg-amber-950/90 border-b border-amber-600/80 px-4 py-2 text-amber-200 text-xs flex items-center justify-between shadow-inner">
      <div className="flex items-center gap-2 font-mono">
        <ShieldAlert className="w-4 h-4 text-amber-400" />
        <span>
          <strong className="text-amber-300">CRITICAL SAFETY REQUIREMENT:</strong> Browser autoplay policy requires user interaction to enable the emergency siren.
        </span>
      </div>
      <button
        type="button"
        onClick={() => setAudioUnlocked(true)}
        className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded text-xs flex items-center gap-1.5 shadow"
      >
        <Check className="w-3.5 h-3.5" />
        <span>ARM AUDIO SIREN</span>
      </button>
    </div>
  );
};
