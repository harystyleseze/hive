"use client";

import { useEffect, useState } from "react";
import type { RiskMetrics, ActionCard } from "@/types";

export function RiskPanel() {
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [pendingActions, setPendingActions] = useState<ActionCard[]>([]);
  const [lastRun, setLastRun] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const data = await res.json();
          setMetrics(data.riskMetrics || null);
          setPendingActions(data.pendingActions || []);
          setLastRun(data.lastMonitorRun || 0);
        }
      } catch { /* ignore */ }
    };
    load();
    const interval = setInterval(load, 8_000);
    return () => clearInterval(interval);
  }, []);

  const triggerMonitor = async () => {
    await fetch("/api/monitor", { method: "POST" });
  };

  const approveAction = async (card: ActionCard) => {
    await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId: card.id, scheduleId: card.scheduleId }),
    });
    setPendingActions((prev) => prev.filter((a) => a.id !== card.id));
  };

  const rejectAction = async (card: ActionCard) => {
    await fetch("/api/approve", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId: card.id, scheduleId: card.scheduleId }),
    });
    setPendingActions((prev) => prev.filter((a) => a.id !== card.id));
  };

  const riskColor = metrics
    ? metrics.riskGrade === "critical"
      ? "text-red-400"
      : metrics.riskGrade === "high"
      ? "text-orange-400"
      : metrics.riskGrade === "medium"
      ? "text-yellow-400"
      : "text-emerald-400"
    : "text-[hsl(var(--muted-foreground))]";

  const riskBarColor = metrics
    ? metrics.compositeRisk >= 85
      ? "bg-red-500"
      : metrics.compositeRisk >= 60
      ? "bg-orange-500"
      : metrics.compositeRisk >= 40
      ? "bg-yellow-500"
      : "bg-emerald-500"
    : "bg-gray-600";

  return (
    <div className="glass-card rounded-xl p-4 animate-fade-up" style={{ animationDelay: "0.15s" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Risk Monitor</h3>
        <button
          onClick={triggerMonitor}
          className="text-xs px-2.5 py-1 rounded-lg bg-[hsl(var(--muted))]/50 hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors border border-[hsl(var(--border))]"
        >
          Run Now
        </button>
      </div>

      {/* Risk score */}
      {metrics ? (
        <div className="mb-4">
          <div className="flex items-end gap-2 mb-2">
            <span className={`text-3xl font-bold font-mono ${riskColor}`}>
              {metrics.compositeRisk}
            </span>
            <span className={`text-sm font-medium mb-1 capitalize ${riskColor}`}>
              {metrics.riskGrade}
            </span>
          </div>
          <div className="w-full h-1.5 bg-[hsl(var(--muted))]/30 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${riskBarColor}`}
              style={{ width: `${metrics.compositeRisk}%` }}
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="text-[hsl(var(--muted-foreground))]">
              Volatility: <span className="text-[hsl(var(--foreground))]">{metrics.volatility}%</span>
              {" "}({metrics.volatilityRegime})
            </div>
            <div className="text-[hsl(var(--muted-foreground))]">
              Sentiment: <span className="text-[hsl(var(--foreground))] capitalize">
                {metrics.sentimentLabel.replace("_", " ")}
              </span>
            </div>
          </div>
          {lastRun > 0 && (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
              Last cycle: {new Date(lastRun).toLocaleTimeString()}
            </p>
          )}
        </div>
      ) : (
        <div className="mb-4 py-4 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No data yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]/60 mt-1">
            Click &quot;Run Now&quot; to start the agent monitor cycle
          </p>
        </div>
      )}

      {/* Pending action cards */}
      {pendingActions.length > 0 && (
        <div>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mb-2">
            Pending Actions ({pendingActions.length})
          </p>
          <div className="space-y-2">
            {pendingActions.map((card) => (
              <div
                key={card.id}
                className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-purple-400 bg-purple-400/10 border border-purple-400/20 px-1.5 py-0.5 rounded">
                      {card.type}
                    </span>
                  </div>
                  {card.scheduleId && card.hashscanUrl && (
                    <a
                      href={card.hashscanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-emerald-400 hover:text-emerald-300"
                    >
                      Schedule ↗
                    </a>
                  )}
                </div>
                <p className="text-xs font-medium text-[hsl(var(--foreground))] mt-1">
                  {card.amount} {card.token} → {card.vault}
                  {card.apy > 0 && <span className="text-emerald-400"> @ {card.apy}% APY</span>}
                </p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">
                  {card.reasoning}
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => approveAction(card)}
                    className="flex-1 py-1 text-xs rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => rejectAction(card)}
                    className="flex-1 py-1 text-xs rounded bg-[hsl(var(--muted))]/30 hover:bg-[hsl(var(--muted))]/50 text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))] transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
