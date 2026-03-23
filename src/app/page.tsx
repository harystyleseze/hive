import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center animate-fade-up">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl font-bold text-emerald-400">H</span>
        </div>

        <h1 className="text-4xl font-bold text-[hsl(var(--foreground))] tracking-tight mb-3">
          Hive
        </h1>
        <p className="text-lg text-[hsl(var(--muted-foreground))] mb-2">
          Multi-Agent DeFi Economy on Hedera
        </p>
        <p className="text-sm text-[hsl(var(--muted-foreground))]/70 max-w-md mx-auto mb-8">
          3 autonomous AI agents discover, hire, and pay each other in HBAR to collaboratively
          manage DeFi strategy. Every decision logged permanently to HCS.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {[
            "Agent-to-Agent HBAR Payments",
            "HOL Registry Discovery",
            "HCS Audit Trail",
            "Bonzo Finance",
            "Hedera Schedule Service",
          ].map((f) => (
            <span
              key={f}
              className="text-xs px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
            >
              {f}
            </span>
          ))}
        </div>

        <div className="flex gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-2.5 text-sm font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-xl transition-colors"
          >
            View Dashboard
          </Link>
          <Link
            href="/chat"
            className="px-6 py-2.5 text-sm font-medium bg-[hsl(var(--muted))]/30 hover:bg-[hsl(var(--muted))]/50 text-[hsl(var(--foreground))] border border-[hsl(var(--border))] rounded-xl transition-colors"
          >
            Chat with Orchestrator
          </Link>
        </div>
      </div>
    </div>
  );
}
