import { NextRequest } from "next/server";
import { runMarketAnalysis } from "@/lib/agents/market-analyst";
import { runRiskAssessment, buildRiskMetrics } from "@/lib/agents/risk-assessor";
import { findAgentsByCapability } from "@/lib/agents/registry";
import { payAgent } from "@/lib/hedera/hts";
import { config } from "@/lib/config";
import { logToHCS, getTopicId } from "@/lib/hedera/hcs";
import {
  addAgentPayment,
  addAgentHire,
  addHCSLogEntry,
  setRiskMetrics,
  setAgentStatus,
  setLastMonitorRun,
  getPositions,
  addPosition,
  isAutoProtectEnabled,
  isMonitorPaused,
  removePosition,
  addActionCard,
  getDashboardState,
} from "@/lib/store";
import { getBonzoTools } from "@/lib/bonzo/plugin";
import type { ActionCard, HCSLogEntry } from "@/types";

// Prevent concurrent monitor runs
let isRunning = false;

export async function POST(req: NextRequest) {
  if (isRunning) {
    return Response.json({ skipped: true, reason: "Monitor cycle already in progress" });
  }
  if (isMonitorPaused()) {
    return Response.json({ skipped: true, reason: "Monitor paused by user" });
  }

  isRunning = true;
  setAgentStatus("analyzing");

  try {
    const now = Date.now();
    setLastMonitorRun(now);

    const marketAccountId = process.env.MARKET_AGENT_ACCOUNT_ID;
    const riskAccountId = process.env.RISK_AGENT_ACCOUNT_ID;

    // ── Step 0: Discover agents via HOL Registry ──
    const [marketAgentsResult, riskAgentsResult] = await Promise.allSettled([
      findAgentsByCapability("market-data", 1),
      findAgentsByCapability("risk-assessment", 1),
    ]);
    const marketUaid =
      marketAgentsResult.status === "fulfilled"
        ? (marketAgentsResult.value[0]?.uaid ?? null)
        : null;
    const riskUaid =
      riskAgentsResult.status === "fulfilled"
        ? (riskAgentsResult.value[0]?.uaid ?? null)
        : null;

    // ── Step 1: Hire Market Analyst (pay 0.1 HBAR) ──
    let marketPayment;
    if (marketAccountId) {
      try {
        marketPayment = await payAgent(
          marketAccountId,
          config.agentPaymentHbar,
          `Hive monitor: market analysis ${new Date().toISOString().slice(0, 10)}`,
          "market-analyst"
        );
        addAgentPayment(marketPayment);
      } catch (err) {
        console.error("[Monitor] Market payment failed:", err);
      }
    }

    const marketAnalysis = await runMarketAnalysis("hedera-hashgraph");
    if (marketPayment) {
      addAgentHire({
        id: crypto.randomUUID(),
        hiringAgent: "orchestrator",
        hiredAgent: "market-analyst",
        service: "monitoring-cycle",
        payment: marketPayment,
        result: { compositeScore: marketAnalysis.compositeScore },
        timestamp: now,
      });
    }

    // ── Step 2: Hire Risk Assessor (pay 0.1 HBAR) ──
    let riskPayment;
    if (riskAccountId) {
      try {
        riskPayment = await payAgent(
          riskAccountId,
          config.agentPaymentHbar,
          `Hive monitor: risk assessment ${new Date().toISOString().slice(0, 10)}`,
          "risk-assessor"
        );
        addAgentPayment(riskPayment);
      } catch (err) {
        console.error("[Monitor] Risk payment failed:", err);
      }
    }

    const positions = getPositions();
    const riskAssessment = runRiskAssessment(marketAnalysis, positions);
    const riskMetrics = buildRiskMetrics(riskAssessment, marketAnalysis);
    setRiskMetrics(riskMetrics);

    if (riskPayment) {
      addAgentHire({
        id: crypto.randomUUID(),
        hiringAgent: "orchestrator",
        hiredAgent: "risk-assessor",
        service: "monitoring-cycle",
        payment: riskPayment,
        result: { compositeRisk: riskAssessment.compositeRisk },
        timestamp: now,
      });
    }

    // ── Step 3: Log monitoring cycle to HCS ──
    const hcsResult = await logToHCS({
      type: "MONITOR_CYCLE",
      action: `Monitor cycle: risk ${riskAssessment.compositeRisk}/100 (${riskAssessment.riskGrade})`,
      reasoning: `Market score ${marketAnalysis.compositeScore}/100, ${marketAnalysis.recommendation}. ${riskAssessment.recommendation}`,
      compositeScore: marketAnalysis.compositeScore,
      compositeRisk: riskAssessment.compositeRisk,
      riskGrade: riskAssessment.riskGrade,
      volatilityRegime: marketAnalysis.volatility.regime,
      fearGreed: marketAnalysis.sentiment.fearGreedValue,
      marketPaymentTx: marketPayment?.transactionId,
      riskPaymentTx: riskPayment?.transactionId,
      positionsCount: positions.length,
      discoveredMarketUaid: marketUaid,
      discoveredRiskUaid: riskUaid,
    });

    const cycleEntry: HCSLogEntry = {
      id: `hcs-monitor-${now}`,
      type: "MONITOR_CYCLE",
      action: `Monitor: risk ${riskAssessment.compositeRisk}/100`,
      reasoning: riskAssessment.recommendation,
      timestamp: now,
      sequenceNumber: hcsResult.sequenceNumber,
      hashscanUrl: hcsResult.hashscanUrl,
      topicId: hcsResult.topicId,
      status: hcsResult.logged ? "logged" : "simulated",
    };
    addHCSLogEntry(cycleEntry);

    // ── Step 4: Auto-protect if risk > 85 and enabled ──
    let autonomousAction = null;
    if (riskAssessment.shouldProtect && isAutoProtectEnabled()) {
      const bonzoTools = getBonzoTools();
      const withdrawTool = bonzoTools["bonzo_withdraw_tool"];
      const aggressivePositions = positions.filter(p => p.riskLevel === "aggressive");

      const withdrawalResults: { vaultId: string; success: boolean; txResult?: unknown }[] = [];

      for (const position of aggressivePositions) {
        try {
          const txResult = await withdrawTool?.execute?.(
            {
              required: { tokenSymbol: position.tokenSymbol, amount: position.depositedAmount },
              optional: { withdrawAll: true },
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { toolCallId: crypto.randomUUID(), messages: [] } as any
          );
          removePosition(position.vaultId);
          withdrawalResults.push({ vaultId: position.vaultId, success: true, txResult });
        } catch (err) {
          console.error(`[AutoProtect] Withdraw failed for ${position.vaultId}:`, err);
          withdrawalResults.push({ vaultId: position.vaultId, success: false });
        }
      }

      const successCount = withdrawalResults.filter(r => r.success).length;
      const actionDescription = aggressivePositions.length === 0
        ? "Auto-protect triggered: no aggressive positions to withdraw"
        : `Auto-protect: withdrew ${successCount}/${aggressivePositions.length} aggressive positions`;

      const autoHcs = await logToHCS({
        type: "AUTONOMOUS_EXECUTION",
        action: actionDescription,
        reasoning: `Risk ${riskAssessment.compositeRisk}/100 exceeded threshold ${config.autoProtectThreshold}. Auto-protect ON.`,
        autonomous: true,
        riskScore: riskAssessment.compositeRisk,
        withdrawals: withdrawalResults,
        timestamp: now,
      });

      addHCSLogEntry({
        id: `hcs-auto-${now}`,
        type: "AUTONOMOUS_EXECUTION",
        action: actionDescription,
        reasoning: `Risk ${riskAssessment.compositeRisk}/100 > ${config.autoProtectThreshold}. Autonomous execution. ${successCount} position(s) withdrawn.`,
        timestamp: now,
        sequenceNumber: autoHcs.sequenceNumber,
        hashscanUrl: autoHcs.hashscanUrl,
        topicId: autoHcs.topicId,
        status: autoHcs.logged ? "logged" : "simulated",
        isAutonomous: true,
      });

      autonomousAction = {
        type: "AUTONOMOUS_EXECUTION",
        description: actionDescription,
        hashscanUrl: autoHcs.hashscanUrl,
        withdrawals: withdrawalResults,
      };
    }

    // ── Step 5: Rebalance — autonomous execution or user action card ──
    let newAction: ActionCard | null = null;
    if (riskAssessment.shouldRebalance && !riskAssessment.shouldProtect) {
      if (config.autonomousMode) {
        // Autonomous: find best conservative Bonzo vault, deposit directly — no human needed
        let vaultToken = "HBARX";
        let vaultName = "HBARX Vault";
        let vaultId = "hbarx-vault";
        let expectedApy = 8.2;

        try {
          const marketRes = await fetch("https://data.bonzo.finance/market");
          if (marketRes.ok) {
            const markets = await marketRes.json();
            const conservativeTokens = ["HBARX", "USDC", "USDT"];
            const found = Array.isArray(markets)
              ? markets.find((m: { symbol?: string; token?: string; supplyApy?: number; apy?: number }) => {
                  const sym = (m.symbol || m.token || "").toUpperCase();
                  return conservativeTokens.includes(sym);
                })
              : null;
            if (found) {
              vaultToken = ((found.symbol || found.token) as string).toUpperCase();
              vaultName = `${vaultToken} Vault`;
              vaultId = `${vaultToken.toLowerCase()}-vault`;
              const apy = Number(found.supplyApy ?? found.apy ?? expectedApy);
              if (!isNaN(apy) && apy > 0) expectedApy = apy;
            }
          }
        } catch { /* use HBARX fallback */ }

        const bonzoTools = getBonzoTools();
        const depositTool = bonzoTools["bonzo_deposit_tool"];
        let depositResult: unknown;
        try {
          depositResult = await depositTool?.execute?.(
            {
              required: { tokenSymbol: vaultToken, amount: config.autoRebalanceAmountHbar },
              optional: {},
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { toolCallId: crypto.randomUUID(), messages: [] } as any
          );
          addPosition({
            vaultId,
            vaultName,
            protocol: "Bonzo Finance",
            depositedAmount: config.autoRebalanceAmountHbar,
            currentValue: config.autoRebalanceAmountHbar,
            apy: expectedApy,
            riskLevel: "conservative",
            depositTimestamp: now,
            tokenSymbol: vaultToken,
          });
        } catch (err) {
          console.error("[AutoRebalance] Deposit failed:", err);
        }

        const rebalanceHcs = await logToHCS({
          type: "AUTONOMOUS_EXECUTION",
          action: `Auto-rebalance: deposited ${config.autoRebalanceAmountHbar} ${vaultToken} into ${vaultName}`,
          reasoning: `Risk ${riskAssessment.compositeRisk}/100 in rebalance zone [${config.rebalanceThreshold}–${config.autoProtectThreshold}]. Autonomous mode: deploying conservatively to reduce exposure.`,
          autonomous: true,
          riskScore: riskAssessment.compositeRisk,
          vault: vaultName,
          amount: config.autoRebalanceAmountHbar,
          token: vaultToken,
          depositResult,
          timestamp: now,
        });

        addHCSLogEntry({
          id: `hcs-rebalance-${now}`,
          type: "AUTONOMOUS_EXECUTION",
          action: `Auto-rebalance: ${config.autoRebalanceAmountHbar} ${vaultToken} → ${vaultName}`,
          reasoning: `Risk ${riskAssessment.compositeRisk}/100. Autonomous rebalance into conservative vault.`,
          timestamp: now,
          sequenceNumber: rebalanceHcs.sequenceNumber,
          hashscanUrl: rebalanceHcs.hashscanUrl,
          topicId: rebalanceHcs.topicId,
          status: rebalanceHcs.logged ? "logged" : "simulated",
          isAutonomous: true,
        });

        autonomousAction = {
          type: "AUTONOMOUS_EXECUTION",
          description: `Auto-rebalance: deposited ${config.autoRebalanceAmountHbar} ${vaultToken} into ${vaultName}`,
          hashscanUrl: rebalanceHcs.hashscanUrl,
        };
      } else {
        // Co-pilot: create action card — human approves on dashboard
        const card: ActionCard = {
          id: `action-monitor-${now}`,
          type: "rebalance",
          vault: "Conservative Positions",
          vaultId: "conservative",
          amount: 0,
          token: "HBAR",
          apy: 5.5,
          riskLevel: "conservative",
          reasoning: riskAssessment.recommendation,
          status: "pending",
          createdAt: now,
        };
        addActionCard(card);
        newAction = card;
      }
    }

    setAgentStatus("monitoring");

    return Response.json({
      success: true,
      cycle: {
        marketScore: marketAnalysis.compositeScore,
        riskScore: riskAssessment.compositeRisk,
        riskGrade: riskAssessment.riskGrade,
        recommendation: riskAssessment.recommendation,
        hcsLogged: hcsResult.logged,
        hashscanUrl: hcsResult.hashscanUrl,
        payments: {
          market: marketPayment ? { txId: marketPayment.transactionId, hashscan: marketPayment.hashscanUrl } : null,
          risk: riskPayment ? { txId: riskPayment.transactionId, hashscan: riskPayment.hashscanUrl } : null,
        },
      },
      newAction,
      autonomousAction,
    });
  } catch (err) {
    setAgentStatus("monitoring");
    console.error("[Monitor] Error:", err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  } finally {
    isRunning = false;
  }
}

export async function GET() {
  return Response.json({
    status: "ok",
    topicId: getTopicId(),
    dashboard: getDashboardState(),
  });
}
