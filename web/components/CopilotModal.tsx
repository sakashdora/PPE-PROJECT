"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAlertsStore } from "@/features/alerts/alerts.store";
import {
  Bot,
  Send,
  X,
  Copy,
  Check,
  RefreshCw,
  Flame,
  FileCheck,
  ShieldAlert,
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
    content: `👋 **ARGUS Safety Intelligence Assistant.**

Ask me about current safety alerts, corner-case suppression metrics, or request an instant Shift Handover audit report.`,
    timestamp: "Online",
  },
];

export const CopilotModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const byId = useAlertsStore((s) => s.byId);
  const [messages, setMessages] = useState<Message[]>(DEFAULT_MESSAGES);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, messages, loading]);

  if (!isOpen) return null;

  const handleSend = async (customPrompt?: string) => {
    const text = (customPrompt || input).trim();
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
            activeAlertCount: Object.keys(byId).length,
          },
        }),
      });

      if (!res.ok || !res.body) throw new Error("Stream connection failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        streamedContent += chunk;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, content: streamedContent } : msg
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: "⚠️ Gateway connection error. Please retry." }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div className="w-full max-w-2xl bg-elevated border border-border rounded-sm shadow-2xl flex flex-col max-h-[85vh] overflow-hidden font-mono">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-surface border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-sm bg-copper/15 border border-copper flex items-center justify-center text-copper">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold font-display text-text-primary text-xs tracking-wide">
                ARGUS AI Safety Intelligence Copilot
              </div>
              <div className="text-[10px] text-text-secondary font-mono">
                Deterministic Intelligence Engine · Air-Gapped Fallback
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMessages(DEFAULT_MESSAGES)}
              className="p-1.5 rounded-sm text-text-secondary hover:text-text-primary hover:bg-surface border border-transparent hover:border-border transition-colors"
              title="Reset Chat"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-sm text-text-secondary hover:text-text-primary hover:bg-surface border border-transparent hover:border-border transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick query chips */}
        <div className="flex gap-2 p-2.5 bg-base border-b border-border overflow-x-auto text-2xs">
          <button
            type="button"
            onClick={() => handleSend("Shift handover summary")}
            className="px-2.5 py-1 rounded-sm bg-surface border border-border hover:border-copper text-text-secondary hover:text-text-primary whitespace-nowrap flex items-center gap-1.5 transition-colors"
          >
            <FileCheck className="w-3 h-3 text-copper" />
            <span>Shift Summary</span>
          </button>
          <button
            type="button"
            onClick={() => handleSend("Forensic audit of Sector 2 fire")}
            className="px-2.5 py-1 rounded-sm bg-surface border border-border hover:border-critical text-text-secondary hover:text-text-primary whitespace-nowrap flex items-center gap-1.5 transition-colors"
          >
            <Flame className="w-3 h-3 text-critical" />
            <span>Sector 2 Fire Audit</span>
          </button>
          <button
            type="button"
            onClick={() => handleSend("Corner case suppression metrics")}
            className="px-2.5 py-1 rounded-sm bg-surface border border-border hover:border-safe text-text-secondary hover:text-text-primary whitespace-nowrap flex items-center gap-1.5 transition-colors"
          >
            <ShieldAlert className="w-3 h-3 text-safe" />
            <span>Corner Cases</span>
          </button>
        </div>

        {/* Messages feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs font-sans min-h-[300px] bg-base">
          {messages.map((msg) => {
            const isAssistant = msg.role === "assistant";
            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isAssistant ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[88%] rounded-sm p-3 leading-relaxed ${
                    isAssistant
                      ? "bg-surface border border-border text-text-primary font-mono text-2xs"
                      : "bg-copper/20 border border-copper text-text-primary font-mono text-2xs"
                  }`}
                >
                  <div className="space-y-1.5 whitespace-pre-wrap">
                    {msg.content || (
                      <span className="text-text-secondary font-mono text-[11px] animate-pulse">
                        Analyzing safety telemetry...
                      </span>
                    )}
                  </div>
                  {isAssistant && msg.content && (
                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="text-[10px] font-mono text-text-secondary hover:text-copper transition-colors inline-flex items-center gap-1"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-safe" />
                            <span className="text-safe">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
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

        {/* Input bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 bg-surface border-t border-border flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about safety incidents or compliance..."
            disabled={loading}
            className="flex-1 px-3 py-1.5 bg-base border border-border rounded-sm text-xs text-text-primary placeholder-text-secondary focus:outline-none focus:border-copper font-mono"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-3.5 py-1.5 rounded-sm bg-copper hover:bg-copper-hover text-base font-bold font-mono text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            <span>Ask</span>
            <Send className="w-3 h-3" />
          </button>
        </form>
      </div>
    </div>
  );
};
