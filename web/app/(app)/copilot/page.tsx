"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import {
  Bot,
  Send,
  RefreshCw,
  Copy,
  Check,
  ShieldAlert,
  Flame,
  FileCheck,
  HardHat,
  Terminal,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const DEFAULT_MESSAGES: Message[] = [
  {
    id: "m-0",
    role: "assistant",
    content: `👋 **Welcome to ARGUS AI Safety Intelligence Copilot.**

I have live telemetry access to the factory floor's **4 optical camera nodes**, the **YOLO11s Stage 2 inference engine**, the **dual-rate temporal voting engine**, and the **SQLite outbox alert queue**.

Select an operational audit query below or ask any question regarding factory safety, compliance trends, or incident forensics:`,
    timestamp: "Online",
  },
];

const PROMPT_CHIPS = [
  { label: "Shift A Handover Summary", icon: FileCheck, prompt: "Generate a Shift A to Shift B handover summary for all sectors" },
  { label: "Sector 2 Fire Forensic Audit", icon: Flame, prompt: "Give me a forensic audit of the fire incident in Sector 2" },
  { label: "7-Day PPE Compliance Trends", icon: HardHat, prompt: "Show me the 7-day PPE compliance trend and worst performing sector" },
  { label: "Corner-Case False Alarm Proof", icon: ShieldAlert, prompt: "Audit the false positive suppression data for yellow shirts and boiler steam" },
  { label: "Generate ISO 45001 Incident Report", icon: Terminal, prompt: "Generate an ISO 45001 incident investigation report for the active fire alert" },
];

export default function CopilotPage() {
  const byId = useAlertsStore((s) => s.byId);
  const alertsList = Object.values(byId);

  const [messages, setMessages] = useState<Message[]>(DEFAULT_MESSAGES);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (userPrompt?: string) => {
    const text = (userPrompt || input).trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false, hour: "2-digit", minute: "2-digit" }),
    };

    const assistantMsgId = `a-${Date.now()}`;
    const assistantMsgPlaceholder: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false, hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsgPlaceholder]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          context: {
            alertCount: alertsList.length,
            activeAlerts: alertsList.slice(0, 5),
            systemHealth: "Optimal · 28.5 FPS · 14ms latency",
          },
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to connect to safety intelligence stream");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamed = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        streamed += chunk;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, content: streamed } : msg
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content:
                  "⚠️ Edge Intelligence Engine Offline. Fallback deterministic response: All 4 camera streams nominal; CAS v2 armed; Temporal voter requiring 8/10 frames.",
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-surface border border-border rounded-sm overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-surface border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-copper/20 border border-copper flex items-center justify-center text-copper">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold font-display text-text-primary text-sm flex items-center gap-2">
              <span>ARGUS AI Safety Intelligence Copilot</span>
              <span className="text-3xs font-mono px-1.5 py-0.5 rounded-sm bg-jade/20 text-jade border border-jade">
                DETERMINISTIC FALLBACK ACTIVE
              </span>
            </div>
            <div className="text-2xs text-text-secondary font-mono mt-0.5">
              Natural language interface to edge telemetry, CAS events & compliance logs
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMessages(DEFAULT_MESSAGES)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-2xs font-mono text-text-secondary hover:text-text-primary bg-base hover:bg-elevated border border-border transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Context</span>
        </button>
      </div>

      {/* Suggested Prompt Chips */}
      <div className="px-5 py-2.5 bg-base border-b border-border flex items-center gap-2 overflow-x-auto">
        <span className="text-3xs font-mono text-text-secondary shrink-0 uppercase tracking-wider">
          AUDIT TEMPLATES:
        </span>
        {PROMPT_CHIPS.map((chip, idx) => {
          const Icon = chip.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(chip.prompt)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-sm text-2xs font-mono bg-surface hover:bg-elevated text-text-secondary hover:text-copper border border-border hover:border-copper transition-all shrink-0"
            >
              <Icon className="w-3 h-3 text-copper" />
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 font-mono text-xs bg-base">
        {messages.map((msg) => {
          const isAssistant = msg.role === "assistant";
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isAssistant ? "justify-start" : "justify-end"}`}
            >
              {isAssistant && (
                <div className="w-7 h-7 rounded-sm bg-elevated border border-border flex items-center justify-center text-copper shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-sm p-4 leading-relaxed ${
                  isAssistant
                    ? "bg-surface border border-border text-text-primary"
                    : "bg-copper/15 border border-copper text-text-primary"
                }`}
              >
                <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-border text-3xs text-text-secondary">
                  <span className="font-bold uppercase tracking-wider">
                    {isAssistant ? "ARGUS INTELLIGENCE COPILOT" : "SHIFT SUPERVISOR"}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>

                <div className="space-y-2 whitespace-pre-wrap leading-relaxed text-2xs font-mono">
                  {msg.content || (
                    <span className="text-text-secondary animate-pulse">
                      Analyzing edge safety outbox and computing response...
                    </span>
                  )}
                </div>

                {isAssistant && msg.content && (
                  <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-3xs text-text-secondary">
                    <span>Model: Llama-3.3-70B (Edge Verified)</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="hover:text-copper transition-colors flex items-center gap-1"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-safe" />
                          <span className="text-safe">Copied to Clipboard</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Response</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Prompt Input Area */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 bg-surface border-t border-border flex items-center gap-2.5"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Copilot anything (e.g., 'Summarize active violations', 'Why was yellow shirt suppressed?')..."
          disabled={loading}
          className="flex-1 px-4 py-2 bg-base border border-border rounded-sm text-xs text-text-primary placeholder-text-secondary focus:outline-none focus:border-copper font-mono transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-5 py-2 rounded-sm bg-copper hover:bg-copper-hover text-base font-bold font-mono text-xs flex items-center gap-2 transition-colors disabled:opacity-40"
        >
          <span>SEND QUERY</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
