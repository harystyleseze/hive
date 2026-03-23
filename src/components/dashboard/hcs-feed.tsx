"use client";

import { useEffect, useState } from "react";
import type { HCSLogEntry } from "@/types";
import { hashscanBase } from "@/lib/client-config";

export function HCSFeed() {
  const [entries, setEntries] = useState<HCSLogEntry[]>([]);
  const [topicId, setTopicId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const data = await res.json();
          setEntries(data.hcsLog || []);
          setTopicId(data.hcsTopicId || null);
        }
      } catch { /* ignore */ }
    };
    load();
    const interval = setInterval(load, 8_000);
    return () => clearInterval(interval);
  }, []);

  const typeColors: Record<string, string> = {
    MONITOR_CYCLE: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    AGENT_HIRE: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    RISK_ASSESSMENT: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    MARKET_ANALYSIS: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
    PROPOSAL: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    USER_APPROVAL: "text-green-400 bg-green-400/10 border-green-400/20",
    AUTONOMOUS_EXECUTION: "text-red-400 bg-red-400/10 border-red-400/20",
    DECISION: "text-slate-400 bg-slate-400/10 border-slate-400/20",
  };

  return (
    <div className="glass-card rounded-xl p-4 animate-fade-up" style={{ animationDelay: "0.2s" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">HCS Audit Trail</h3>
        {topicId && (
          <a
            href={`${hashscanBase}/topic/${topicId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-400 hover:text-emerald-300 font-mono"
          >
            {topicId} ↗
          </a>
        )}
      </div>

      <div className="space-y-2 max-h-[320px] overflow-y-auto">
        {entries.length === 0 ? (
          <div className="text-center py-8 text-[hsl(var(--muted-foreground))] text-sm">
            <p>Waiting for first monitor cycle...</p>
            <p className="text-xs mt-1 opacity-60">HCS topic will auto-create on first run</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={`rounded-lg p-3 border ${entry.isAutonomous ? "border-red-400/30 bg-red-400/5" : "border-[hsl(var(--border))]"}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      typeColors[entry.type] || typeColors.DECISION
                    }`}
                  >
                    {entry.type}
                  </span>
                  {entry.isAutonomous && (
                    <span className="text-[10px] font-bold text-red-400 bg-red-400/10 border border-red-400/30 px-1.5 py-0.5 rounded">
                      AUTONOMOUS
                    </span>
                  )}
                  {entry.sequenceNumber && (
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono">
                      #{entry.sequenceNumber}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-xs text-[hsl(var(--foreground))] font-medium">{entry.action}</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">
                {entry.reasoning}
              </p>
              {entry.hashscanUrl && entry.status === "logged" && (
                <a
                  href={entry.hashscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 mt-1 inline-block"
                >
                  View on Hashscan ↗
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
