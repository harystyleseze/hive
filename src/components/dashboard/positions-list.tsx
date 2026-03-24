"use client";

import { useEffect, useState } from "react";
import type { VaultPosition } from "@/types";
import { hashscanBase } from "@/lib/client-config";

const riskColors: Record<string, string> = {
  conservative: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  moderate: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  aggressive: "text-red-400 bg-red-400/10 border-red-400/20",
};

export function PositionsList() {
  const [positions, setPositions] = useState<VaultPosition[]>([]);
  const [withdrawing, setWithdrawing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) setPositions((await res.json()).positions || []);
      } catch { /* ignore */ }
    };
    load();
    const interval = setInterval(load, 8_000);
    return () => clearInterval(interval);
  }, []);

  const withdraw = async (position: VaultPosition, all = false) => {
    setWithdrawing(prev => ({ ...prev, [position.vaultId]: true }));
    try {
      await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vaultId: position.vaultId,
          tokenSymbol: position.tokenSymbol,
          amount: position.depositedAmount,
          withdrawAll: all,
        }),
      });
      setPositions(prev => prev.filter(p => p.vaultId !== position.vaultId));
    } finally {
      setWithdrawing(prev => ({ ...prev, [position.vaultId]: false }));
    }
  };

  const withdrawAll = async () => {
    for (const p of positions) await withdraw(p, true);
  };

  if (positions.length === 0) return null;

  const totalValue = positions.reduce((s, p) => s + p.currentValue, 0);

  return (
    <div className="glass-card rounded-xl p-4 animate-fade-up" style={{ animationDelay: "0.2s" }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Positions</h3>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
            Total: <span className="font-mono text-[hsl(var(--foreground))]">{totalValue.toFixed(4)} ℏ</span>
          </p>
        </div>
        <button
          onClick={withdrawAll}
          className="text-xs px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 transition-colors cursor-pointer"
        >
          Withdraw All
        </button>
      </div>

      <div className="space-y-2">
        {positions.map(position => (
          <div
            key={position.vaultId}
            className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 p-3"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div>
                <p className="text-xs font-medium text-[hsl(var(--foreground))]">{position.vaultName}</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{position.protocol}</p>
              </div>
              <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${riskColors[position.riskLevel] ?? riskColors.moderate}`}>
                {position.riskLevel}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1 text-[10px] mb-2">
              <div className="text-[hsl(var(--muted-foreground))]">
                Deposited
                <div className="font-mono text-[hsl(var(--foreground))]">{position.depositedAmount} ℏ</div>
              </div>
              <div className="text-[hsl(var(--muted-foreground))]">
                Current
                <div className="font-mono text-emerald-400">{position.currentValue.toFixed(4)} ℏ</div>
              </div>
              <div className="text-[hsl(var(--muted-foreground))]">
                APY
                <div className="font-mono text-[hsl(var(--foreground))]">{position.apy}%</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => withdraw(position, true)}
                disabled={withdrawing[position.vaultId]}
                className="flex-1 py-1 text-xs rounded bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {withdrawing[position.vaultId] ? "Withdrawing…" : "Withdraw"}
              </button>
              {position.transactionId && (
                <a
                  href={`${hashscanBase}/transaction/${position.transactionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 shrink-0 cursor-pointer"
                >
                  Tx ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
