"use client";

import { useEffect, useState } from "react";
import type { AgentPayment, AgentHire } from "@/types";

interface AgentNode {
  id: string;
  label: string;
  accountId: string;
  status: "active" | "idle";
  uaid?: string | null;
}

export function AgentNetwork() {
  const [payments, setPayments] = useState<AgentPayment[]>([]);
  const [hires, setHires] = useState<AgentHire[]>([]);
  const [uaids, setUaids] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const data = await res.json();
          setPayments(data.agentPayments || []);
          setHires(data.agentHires || []);
          setUaids(data.agentUaids || {});
        }
      } catch { /* ignore */ }
    };
    load();
    const interval = setInterval(load, 8_000);
    return () => clearInterval(interval);
  }, []);

  const agents: AgentNode[] = [
    {
      id: "orchestrator",
      label: "Orchestrator",
      accountId: process.env.NEXT_PUBLIC_HEDERA_ACCOUNT_ID || "—",
      status: "active",
      uaid: uaids.orchestrator,
    },
    {
      id: "market-analyst",
      label: "Market Analyst",
      accountId: process.env.NEXT_PUBLIC_MARKET_AGENT_ACCOUNT_ID || "—",
      status: hires.some(h => h.hiredAgent === "market-analyst") ? "active" : "idle",
      uaid: uaids.marketAnalyst,
    },
    {
      id: "risk-assessor",
      label: "Risk Assessor",
      accountId: process.env.NEXT_PUBLIC_RISK_AGENT_ACCOUNT_ID || "—",
      status: hires.some(h => h.hiredAgent === "risk-assessor") ? "active" : "idle",
      uaid: uaids.riskAssessor,
    },
  ];

  const recentHires = hires.slice(0, 5);

  return (
    <div className="glass-card rounded-xl p-4 animate-fade-up" style={{ animationDelay: "0.1s" }}>
      <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-3">Agent Network</h3>

      {/* Agent nodes */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`rounded-lg p-3 border text-center ${
              agent.status === "active"
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20"
            }`}
          >
            <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-xs font-bold ${
              agent.id === "orchestrator"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-blue-500/20 text-blue-400"
            }`}>
              {agent.label[0]}
            </div>
            <p className="text-[11px] font-medium text-[hsl(var(--foreground))] leading-tight">
              {agent.label}
            </p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono mt-0.5">
              {agent.accountId !== "—" ? agent.accountId : "not set"}
            </p>
            {agent.uaid && (
              <p className="text-[9px] text-blue-400/70 mt-0.5 truncate">HOL ✓</p>
            )}
            <div className={`mt-1.5 flex items-center justify-center gap-1 ${
              agent.status === "active" ? "text-emerald-400" : "text-[hsl(var(--muted-foreground))]"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full bg-current ${
                agent.status === "active" ? "animate-pulse" : "opacity-40"
              }`} />
              <span className="text-[10px] capitalize">{agent.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent hires / payments */}
      <div>
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] mb-2">
          Recent Agent Transactions
        </p>
        {recentHires.length === 0 ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-3">
            Payments appear here after the first monitor cycle
          </p>
        ) : (
          <div className="space-y-1.5">
            {recentHires.map((hire) => (
              <div
                key={hire.id}
                className="flex items-center justify-between text-[11px] py-1.5 px-2 rounded bg-[hsl(var(--muted))]/20"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400">orchestrator</span>
                  <span className="text-[hsl(var(--muted-foreground))]">→</span>
                  <span className="text-blue-400">{hire.hiredAgent}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-yellow-400">
                    {hire.payment?.hbarAmount?.toFixed(1) ?? "0.1"} ℏ
                  </span>
                  {hire.payment?.hashscanUrl && (
                    <a
                      href={hire.payment.hashscanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
                    >
                      ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
