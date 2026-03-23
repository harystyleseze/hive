"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { hashscanBase } from "@/lib/client-config";

interface DashboardState {
  hcsMessageCount: number;
  totalHbarPaid: number;
  agentStatus: string;
  autoProtectEnabled: boolean;
  monitorPaused: boolean;
  hcsTopicId: string | null;
}

export function Header() {
  const [state, setState] = useState<DashboardState | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) setState(await res.json());
      } catch { /* ignore */ }
    };
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, []);

  const toggleAutoProtect = async () => {
    const res = await fetch("/api/dashboard", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoProtect: !state?.autoProtectEnabled }),
    });
    if (res.ok) {
      const data = await res.json();
      setState(prev => prev ? { ...prev, autoProtectEnabled: data.state.autoProtectEnabled } : null);
    }
  };

  const toggleMonitorPaused = async () => {
    const res = await fetch("/api/dashboard", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monitorPaused: !state?.monitorPaused }),
    });
    if (res.ok) {
      const data = await res.json();
      setState(prev => prev ? { ...prev, monitorPaused: data.state.monitorPaused } : null);
    }
  };

  const statusColor: Record<string, string> = {
    monitoring: "text-emerald-400",
    analyzing: "text-yellow-400",
    executing: "text-orange-400",
    offline: "text-red-400",
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 backdrop-blur-md">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <span className="text-emerald-400 text-sm font-bold">H</span>
          </div>
          <span className="font-semibold text-sm tracking-tight">
            Hive
            <span className="text-[hsl(var(--muted-foreground))] font-normal ml-1 text-xs hidden sm:inline">
              Multi-Agent DeFi
            </span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden sm:flex items-center gap-5 text-xs text-[hsl(var(--muted-foreground))]">
          <Link href="/dashboard" className="hover:text-[hsl(var(--foreground))] transition-colors">
            Dashboard
          </Link>
          <Link href="/chat" className="hover:text-[hsl(var(--foreground))] transition-colors">
            Chat
          </Link>
        </nav>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs">
          {/* HCS counter */}
          {state && (
            <a
              href={state.hcsTopicId
                ? `${hashscanBase}/topics/${state.hcsTopicId}`
                : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono">{state.hcsMessageCount}</span>
              <span className="text-emerald-400/70">on-chain</span>
            </a>
          )}

          {/* HBAR paid */}
          {state && state.totalHbarPaid > 0 && (
            <div className="hidden md:flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
              <span className="font-mono text-xs">{state.totalHbarPaid.toFixed(2)}</span>
              <span>ℏ paid</span>
            </div>
          )}

          {/* Agent status */}
          {state && (
            <div className={`flex items-center gap-1 ${statusColor[state.agentStatus] || "text-gray-400"}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-glow-pulse" />
              <span className="hidden sm:block capitalize">{state.agentStatus}</span>
            </div>
          )}

          {/* Pause monitor toggle */}
          <button
            onClick={toggleMonitorPaused}
            className={`hidden sm:block px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              state?.monitorPaused
                ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20"
                : "bg-[hsl(var(--muted))]/50 border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {state?.monitorPaused ? "Paused" : "Pause"}
          </button>

          {/* Auto-protect toggle */}
          <button
            onClick={toggleAutoProtect}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              state?.autoProtectEnabled
                ? "bg-orange-500/15 border-orange-500/30 text-orange-400 hover:bg-orange-500/20"
                : "bg-[hsl(var(--muted))]/50 border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {state?.autoProtectEnabled ? "Auto-Protect ON" : "Auto-Protect"}
          </button>
        </div>
      </div>
    </header>
  );
}
