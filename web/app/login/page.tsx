"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, User, ArrowRight, CheckCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("supervisor.sharma");
  const [password, setPassword] = useState("••••••••••••");
  const [role, setRole] = useState("Shift Supervisor");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/wall");
  };

  const handleQuickRole = (r: string, u: string) => {
    setRole(r);
    setUsername(u);
  };

  return (
    <div className="min-h-screen bg-industrial-950 flex items-center justify-center p-4 relative overflow-hidden crt-grid">
      {/* Background Accent Glows */}
      <div className="absolute w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none -top-20 -left-20" />
      <div className="absolute w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none -bottom-20 -right-20" />

      <div className="w-full max-w-md bg-industrial-900 border border-industrial-750 rounded-2xl shadow-2xl p-6 sm:p-8 relative z-10 font-mono">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-red-600/20 border border-red-500/50 flex items-center justify-center shadow-inner">
            <ShieldCheck className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-black text-white tracking-wider uppercase">
            FACTORY SAFETY AI
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Edge-First Industrial Computer Vision · PS06
          </p>
        </div>

        {/* Quick Role Selection for Hackathon Demo */}
        <div className="mb-6">
          <div className="text-3xs text-slate-500 uppercase tracking-wider mb-2 font-bold">
            Demo Fast-Login Persona:
          </div>
          <div className="grid grid-cols-3 gap-2 text-3xs">
            <button
              type="button"
              onClick={() => handleQuickRole("Shift Supervisor", "supervisor.sharma")}
              className={`p-2 rounded border transition-all text-center ${
                role === "Shift Supervisor"
                  ? "bg-industrial-800 border-red-500 text-white"
                  : "bg-industrial-950 border-industrial-800 text-slate-400 hover:text-white"
              }`}
            >
              Supervisor
            </button>
            <button
              type="button"
              onClick={() => handleQuickRole("Safety Officer", "officer.patel")}
              className={`p-2 rounded border transition-all text-center ${
                role === "Safety Officer"
                  ? "bg-industrial-800 border-sky-500 text-white"
                  : "bg-industrial-950 border-industrial-800 text-slate-400 hover:text-white"
              }`}
            >
              Safety Officer
            </button>
            <button
              type="button"
              onClick={() => handleQuickRole("Plant Admin", "admin.factory")}
              className={`p-2 rounded border transition-all text-center ${
                role === "Plant Admin"
                  ? "bg-industrial-800 border-amber-500 text-white"
                  : "bg-industrial-950 border-industrial-800 text-slate-400 hover:text-white"
              }`}
            >
              Plant Admin
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 text-3xs uppercase font-bold mb-1">
              Operator Username / ID:
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-industrial-950 border border-industrial-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-3xs uppercase font-bold mb-1">
              Local Password / PIN:
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-industrial-950 border border-industrial-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all transform active:scale-98 mt-2"
          >
            <span>Access Supervisor Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Security & Offline Certification Notice */}
        <div className="mt-6 pt-4 border-t border-industrial-800 text-center text-3xs text-slate-500 space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-bold">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>On-Premise LAN Authentication Only</span>
          </div>
          <div>Zero WAN telemetry · No biometrics or facial recognition</div>
        </div>
      </div>
    </div>
  );
}
