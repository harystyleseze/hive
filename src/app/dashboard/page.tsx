"use client";

import { useEffect } from "react";
import { Header } from "@/components/layout/header";
import { AgentNetwork } from "@/components/dashboard/agent-network";
import { HCSFeed } from "@/components/dashboard/hcs-feed";
import { RiskPanel } from "@/components/dashboard/risk-panel";
import { PositionsList } from "@/components/dashboard/positions-list";

/** Fires POST /api/monitor immediately on mount, then every 30s. */
function MonitorPoller() {
  useEffect(() => {
    const run = () =>
      fetch("/api/monitor", { method: "POST" }).catch(() => {});
    run();
    const id = setInterval(run, 30_000);
    return () => clearInterval(id);
  }, []);
  return null;
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <MonitorPoller />
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[hsl(var(--foreground))] animate-fade-up">
            Agent Dashboard
          </h1>
          <p
            className="text-sm text-[hsl(var(--muted-foreground))] mt-1 animate-fade-up"
            style={{ animationDelay: "0.05s" }}
          >
            3 autonomous agents coordinating DeFi strategy on Hedera. Every decision logged on-chain.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column */}
          <div className="lg:col-span-1 space-y-4">
            <AgentNetwork />
            <RiskPanel />
            <PositionsList />
          </div>

          {/* Right column — HCS feed */}
          <div className="lg:col-span-2">
            <HCSFeed />
          </div>
        </div>
      </main>
    </div>
  );
}
