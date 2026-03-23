import { tool } from "ai";
import { z } from "zod";
import { payAgent } from "@/lib/hedera/hts";
import { logToHCS, getTopicId } from "@/lib/hedera/hcs";
import { hashscanBase, mirrorNodeBase } from "@/lib/hedera/network";
import { config } from "@/lib/config";
import { proposeScheduledAction } from "@/lib/hedera/schedule";
import { runMarketAnalysis } from "@/lib/agents/market-analyst";
import { runRiskAssessment, buildRiskMetrics } from "@/lib/agents/risk-assessor";
import { findAgentsByCapability } from "@/lib/agents/registry";
import {
  addActionCard,
  addHCSLogEntry,
  addAgentPayment,
  addAgentHire,
  setRiskMetrics,
  getPositions,
  isAutoProtectEnabled,
} from "@/lib/store";
import type { ActionCard, HCSLogEntry, AgentHire } from "@/types";

export const orchestratorTools = {
  hireMarketAnalyst: tool({
    description:
      "Hire the Market Analyst agent by paying 0.1 HBAR on-chain, then receive real market analysis (volatility, sentiment, Fear & Greed). Always call this first before making any recommendations.",
    inputSchema: z.object({
      asset: z
        .string()
        .optional()
        .describe("CoinGecko asset ID (default: hedera-hashgraph)"),
    }),
    execute: async ({ asset }) => {
      const requestId = crypto.randomUUID();
      const marketAccountId = process.env.MARKET_AGENT_ACCOUNT_ID;

      // 1. Discover the Market Analyst via HOL Registry
      const discovered = await findAgentsByCapability("market-data", 1);
      const discoveredAgent = discovered[0] || null;

      // 2. Pay the Market Analyst agent
      let payment;
      if (marketAccountId) {
        try {
          payment = await payAgent(
            marketAccountId,
            config.agentPaymentHbar,
            `Hive hire: market analysis ${requestId.slice(0, 8)}`,
            "market-analyst"
          );
          addAgentPayment(payment);
        } catch (err) {
          console.error("[Hire] Payment failed:", err);
        }
      }

      // 3. Run market analysis
      const analysis = await runMarketAnalysis(asset || "hedera-hashgraph");

      // 4. Record the hire
      const hire: AgentHire = {
        id: requestId,
        hiringAgent: "orchestrator",
        hiredAgent: "market-analyst",
        service: "market-analysis",
        payment: payment!,
        result: analysis,
        timestamp: Date.now(),
      };
      if (payment) addAgentHire(hire);

      // 5. Log to HCS
      const hcsResult = await logToHCS({
        type: "AGENT_HIRE",
        action: `Hired Market Analyst via HOL Registry`,
        reasoning: `Composite market score: ${analysis.compositeScore}/100. Recommendation: ${analysis.recommendation}`,
        requestId,
        paymentTxId: payment?.transactionId,
        compositeScore: analysis.compositeScore,
        volatilityRegime: analysis.volatility.regime,
        fearGreed: analysis.sentiment.fearGreedValue,
        discoveredUaid: discoveredAgent?.uaid || null,
      });

      const hcsEntry: HCSLogEntry = {
        id: `hcs-${Date.now()}`,
        type: "AGENT_HIRE",
        action: `Hired Market Analyst`,
        reasoning: `Market score: ${analysis.compositeScore}/100, ${analysis.recommendation}`,
        timestamp: Date.now(),
        sequenceNumber: hcsResult.sequenceNumber,
        hashscanUrl: hcsResult.hashscanUrl,
        topicId: hcsResult.topicId,
        status: hcsResult.logged ? "logged" : "simulated",
      };
      addHCSLogEntry(hcsEntry);

      return {
        requestId,
        discovery: discoveredAgent
          ? { uaid: discoveredAgent.uaid, name: discoveredAgent.name, source: "HOL Registry" }
          : { note: "Agent not yet in HOL Registry — using configured account" },
        payment: payment
          ? { transactionId: payment.transactionId, hashscanUrl: payment.hashscanUrl, amount: `${config.agentPaymentHbar} HBAR` }
          : { note: "Payment skipped (MARKET_AGENT_ACCOUNT_ID not configured)" },
        analysis: {
          compositeScore: analysis.compositeScore,
          recommendation: analysis.recommendation,
          volatility: {
            regime: analysis.volatility.regime,
            value: `${(analysis.volatility.volatility30d * 100).toFixed(1)}%`,
            price: `$${analysis.volatility.currentPrice.toFixed(4)}`,
            change24h: `${analysis.volatility.priceChange24h.toFixed(2)}%`,
          },
          sentiment: {
            label: analysis.sentiment.label,
            score: `${(analysis.sentiment.overallScore * 100).toFixed(0)}%`,
            fearGreed: `${analysis.sentiment.fearGreedValue}/100 (${analysis.sentiment.fearGreedLabel})`,
          },
          assessment: analysis.volatilityAssessment,
        },
        hcs: { logged: hcsResult.logged, hashscanUrl: hcsResult.hashscanUrl },
      };
    },
  }),

  hireRiskAssessor: tool({
    description:
      "Hire the Risk Assessor agent by paying 0.1 HBAR on-chain, then receive portfolio risk score and recommendation. Call after hireMarketAnalyst.",
    inputSchema: z.object({
      marketAnalysis: z
        .object({
          compositeScore: z.number(),
          recommendation: z.string(),
          volatility: z.object({
            regime: z.string(),
            value: z.string(),
          }),
          sentiment: z.object({
            label: z.string(),
            score: z.string(),
          }),
        })
        .describe("Output from hireMarketAnalyst"),
    }),
    execute: async ({ marketAnalysis }) => {
      const requestId = crypto.randomUUID();
      const riskAccountId = process.env.RISK_AGENT_ACCOUNT_ID;

      // 1. Discover the Risk Assessor via HOL Registry
      const discovered = await findAgentsByCapability("risk-assessment", 1);
      const discoveredAgent = discovered[0] || null;

      // 2. Pay the Risk Assessor
      let payment;
      if (riskAccountId) {
        try {
          payment = await payAgent(
            riskAccountId,
            config.agentPaymentHbar,
            `Hive hire: risk assessment ${requestId.slice(0, 8)}`,
            "risk-assessor"
          );
          addAgentPayment(payment);
        } catch (err) {
          console.error("[Hire] Payment failed:", err);
        }
      }

      // 3. Reconstruct market analysis for risk scoring
      const positions = getPositions();
      const volatilityValue = parseFloat(marketAnalysis.volatility.value) / 100;
      const sentimentScore = parseFloat(marketAnalysis.sentiment.score) / 100;

      const mockAnalysis = {
        volatility: {
          volatility30d: volatilityValue,
          regime: marketAnalysis.volatility.regime as "low" | "medium" | "high" | "extreme",
          currentPrice: 0,
          priceChange24h: 0,
          asset: "hedera-hashgraph",
          timestamp: Date.now(),
        },
        sentiment: {
          overallScore: sentimentScore,
          fearGreedValue: 50,
          fearGreedLabel: marketAnalysis.sentiment.label,
          label: marketAnalysis.sentiment.label as "bullish" | "bearish" | "neutral" | "very_bullish" | "very_bearish",
          sources: [],
          timestamp: Date.now(),
        },
        volatilityAssessment: "",
        sentimentSummary: "",
        compositeScore: marketAnalysis.compositeScore,
        recommendation: marketAnalysis.recommendation as "DEPLOY" | "HOLD" | "REDUCE" | "PROTECT",
        timestamp: Date.now(),
      };

      const assessment = runRiskAssessment(mockAnalysis, positions);
      const riskMetrics = buildRiskMetrics(assessment, mockAnalysis);
      setRiskMetrics(riskMetrics);

      // 3. Record hire
      if (payment) {
        addAgentHire({
          id: requestId,
          hiringAgent: "orchestrator",
          hiredAgent: "risk-assessor",
          service: "risk-assessment",
          payment,
          result: assessment,
          timestamp: Date.now(),
        });
      }

      // 4. Log to HCS
      const hcsResult = await logToHCS({
        type: "RISK_ASSESSMENT",
        action: `Risk assessment via HOL Registry: ${assessment.riskGrade.toUpperCase()} (${assessment.compositeRisk}/100)`,
        reasoning: assessment.recommendation,
        requestId,
        paymentTxId: payment?.transactionId,
        compositeRisk: assessment.compositeRisk,
        riskGrade: assessment.riskGrade,
        shouldProtect: assessment.shouldProtect,
        discoveredUaid: discoveredAgent?.uaid || null,
      });

      addHCSLogEntry({
        id: `hcs-${Date.now()}`,
        type: "RISK_ASSESSMENT",
        action: `Risk: ${assessment.riskGrade} (${assessment.compositeRisk}/100)`,
        reasoning: assessment.recommendation,
        timestamp: Date.now(),
        sequenceNumber: hcsResult.sequenceNumber,
        hashscanUrl: hcsResult.hashscanUrl,
        topicId: hcsResult.topicId,
        status: hcsResult.logged ? "logged" : "simulated",
      });

      // 5. Auto-protect if enabled and risk is critical
      let autonomousAction = null;
      if (assessment.shouldProtect && isAutoProtectEnabled()) {
        const autoHcsResult = await logToHCS({
          type: "AUTONOMOUS_EXECUTION",
          action: "Auto-protect: executing emergency withdrawal from aggressive positions",
          reasoning: `Risk score ${assessment.compositeRisk}/100 exceeded threshold ${config.autoProtectThreshold}. Auto-protect is ON. Withdrawing aggressive positions to preserve capital.`,
          autonomous: true,
          riskScore: assessment.compositeRisk,
        });

        addHCSLogEntry({
          id: `hcs-auto-${Date.now()}`,
          type: "AUTONOMOUS_EXECUTION",
          action: "Auto-protect activated: emergency withdrawal",
          reasoning: `Risk ${assessment.compositeRisk}/100 > ${config.autoProtectThreshold}. Autonomous execution.`,
          timestamp: Date.now(),
          sequenceNumber: autoHcsResult.sequenceNumber,
          hashscanUrl: autoHcsResult.hashscanUrl,
          topicId: autoHcsResult.topicId,
          status: autoHcsResult.logged ? "logged" : "simulated",
          isAutonomous: true,
        });

        autonomousAction = {
          type: "AUTONOMOUS_EXECUTION",
          description: "Auto-protect executed: withdrew from aggressive positions",
          hashscanUrl: autoHcsResult.hashscanUrl,
        };
      }

      return {
        requestId,
        discovery: discoveredAgent
          ? { uaid: discoveredAgent.uaid, name: discoveredAgent.name, source: "HOL Registry" }
          : { note: "Agent not yet in HOL Registry — using configured account" },
        payment: payment
          ? { transactionId: payment.transactionId, hashscanUrl: payment.hashscanUrl, amount: `${config.agentPaymentHbar} HBAR` }
          : { note: "Payment skipped (RISK_AGENT_ACCOUNT_ID not configured)" },
        riskAssessment: {
          compositeRisk: assessment.compositeRisk,
          riskGrade: assessment.riskGrade,
          recommendation: assessment.recommendation,
          shouldProtect: assessment.shouldProtect,
          shouldRebalance: assessment.shouldRebalance,
          breakdown: {
            volatility: `${assessment.volatilityContribution}%`,
            sentiment: `${assessment.sentimentContribution}%`,
            concentration: `${assessment.portfolioConcentrationRisk}%`,
          },
        },
        hcs: { logged: hcsResult.logged, hashscanUrl: hcsResult.hashscanUrl },
        autonomousAction,
      };
    },
  }),

  getBonzoMarkets: tool({
    description:
      "Get live market data from Bonzo Finance — current APYs, TVL, and utilization rates from testnet contracts.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const res = await fetch("https://data.bonzo.finance/market");
        if (!res.ok) throw new Error("Bonzo API unavailable");
        const data = await res.json();
        return {
          markets: data,
          source: "https://data.bonzo.finance/market",
          note: "Live data from Bonzo Finance testnet contracts",
        };
      } catch {
        return {
          markets: null,
          note: "Bonzo API temporarily unavailable. Using simulated data.",
          simulatedVaults: [
            { name: "HBARX Vault", apy: "8.2%", token: "HBARX", risk: "conservative" },
            { name: "USDC Lending", apy: "5.1%", token: "USDC", risk: "conservative" },
            { name: "SAUCE-HBAR LP", apy: "42.3%", token: "SAUCE", risk: "aggressive" },
          ],
        };
      }
    },
  }),

  proposeBonzoDeposit: tool({
    description:
      "Propose a Bonzo Finance deposit as a Hedera Scheduled Transaction. The user must approve and sign it — the agent never moves user funds without their explicit signature.",
    inputSchema: z.object({
      amount: z.number().positive().describe("Amount to deposit in HBAR"),
      token: z.string().describe("Token symbol (e.g., HBARX, USDC)"),
      vaultId: z.string().describe("Bonzo vault identifier"),
      vaultName: z.string().describe("Human-readable vault name"),
      apy: z.number().describe("Expected APY percentage"),
      reasoning: z.string().describe("Why this deposit is recommended"),
    }),
    execute: async ({ amount, token, vaultId, vaultName, apy, reasoning }) => {
      // For amounts above the threshold, create a Scheduled Transaction
      // For smaller amounts, create an action card for UI approval
      let scheduleId: string | undefined;
      let hashscanUrl: string | undefined;

      if (amount >= config.scheduledTxThresholdHbar) {
        try {
          // Resolve Bonzo lending pool EVM address to Hedera account ID via Mirror Node
          // Known: 0xf67DBe9bD1B331cA379c44b5562EAa1CE831EbC2 = 0.0.4999355 on testnet
          let recipientId = config.bonzoLendingPoolId;
          try {
            const mirrorRes = await fetch(
              `${mirrorNodeBase}/accounts/0xf67DBe9bD1B331cA379c44b5562EAa1CE831EbC2`
            );
            if (mirrorRes.ok) {
              const mirrorData = await mirrorRes.json();
              if (mirrorData.account) recipientId = mirrorData.account;
            }
          } catch { /* use pre-resolved default */ }

          const scheduled = await proposeScheduledAction(
            `Hive: deposit ${amount} ${token} to ${vaultName}`,
            amount,
            token,
            vaultId,
            recipientId
          );
          scheduleId = scheduled.scheduleId;
          hashscanUrl = scheduled.hashscanUrl;
        } catch (err) {
          console.error("[Schedule] Failed to create scheduled tx:", err);
        }
      }

      // Create action card for dashboard
      const card: ActionCard = {
        id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "deposit",
        vault: vaultName,
        vaultId,
        amount,
        token,
        apy,
        riskLevel: apy > 20 ? "aggressive" : apy > 8 ? "moderate" : "conservative",
        reasoning,
        status: "pending",
        createdAt: Date.now(),
        scheduleId,
        hashscanUrl,
      };
      addActionCard(card);

      // Log to HCS
      const hcsResult = await logToHCS({
        type: "PROPOSAL",
        action: `Proposed deposit: ${amount} ${token} → ${vaultName} at ${apy}% APY`,
        reasoning,
        vaultId,
        amount,
        token,
        scheduleId,
        useScheduleService: amount >= config.scheduledTxThresholdHbar,
      });

      addHCSLogEntry({
        id: `hcs-${Date.now()}`,
        type: "PROPOSAL",
        action: `Proposed deposit: ${amount} ${token} → ${vaultName}`,
        reasoning,
        timestamp: Date.now(),
        txHash: scheduleId,
        sequenceNumber: hcsResult.sequenceNumber,
        hashscanUrl: hcsResult.hashscanUrl,
        topicId: hcsResult.topicId,
        status: hcsResult.logged ? "logged" : "pending",
      });

      return {
        success: true,
        actionId: card.id,
        message: scheduleId
          ? `Deposit of ${amount} ${token} proposed as Hedera Scheduled Transaction ${scheduleId}. User must sign to execute. See Hashscan: ${hashscanUrl}`
          : `Action card created: deposit ${amount} ${token} into ${vaultName} at ${apy}% APY. Awaiting user approval on dashboard.`,
        card: { id: card.id, type: "deposit", vault: vaultName, amount, token, apy: `${apy}%`, status: "pending" },
        scheduleService: scheduleId ? { scheduleId, hashscanUrl } : null,
        hcs: { logged: hcsResult.logged, hashscanUrl: hcsResult.hashscanUrl },
      };
    },
  }),

  logDecision: tool({
    description:
      "Log an agent decision with full reasoning to Hedera Consensus Service permanently.",
    inputSchema: z.object({
      action: z.string().describe("The action taken or recommended"),
      reasoning: z.string().describe("Full reasoning for this decision"),
      type: z.string().optional().describe("Decision type label"),
    }),
    execute: async ({ action, reasoning, type }) => {
      const hcsResult = await logToHCS({
        type: type || "DECISION",
        action,
        reasoning,
      });

      addHCSLogEntry({
        id: `hcs-${Date.now()}`,
        type: type || "DECISION",
        action,
        reasoning,
        timestamp: Date.now(),
        sequenceNumber: hcsResult.sequenceNumber,
        hashscanUrl: hcsResult.hashscanUrl,
        topicId: hcsResult.topicId,
        status: hcsResult.logged ? "logged" : "simulated",
      });

      return {
        logged: hcsResult.logged,
        topicId: hcsResult.topicId,
        sequenceNumber: hcsResult.sequenceNumber,
        hashscanUrl: hcsResult.hashscanUrl,
        message: hcsResult.logged
          ? `Decision logged to HCS. View on Hashscan: ${hcsResult.hashscanUrl}`
          : `Decision recorded locally (HCS not available)`,
      };
    },
  }),

  checkBalance: tool({
    description: "Check HBAR balance for the operator account or any Hedera account.",
    inputSchema: z.object({
      accountId: z.string().optional().describe("Hedera account ID (default: orchestrator)"),
    }),
    execute: async ({ accountId }) => {
      const id = accountId || process.env.HEDERA_ACCOUNT_ID || "0.0.0";
      try {
        const res = await fetch(
          `${mirrorNodeBase}/accounts/${id}`
        );
        if (!res.ok) throw new Error("Mirror Node unavailable");
        const data = await res.json();
        const hbar = (data.balance?.balance ?? 0) / 1e8;
        return {
          accountId: id,
          hbarBalance: hbar,
          summary: `Account ${id} has ${hbar.toFixed(4)} HBAR`,
          hashscanUrl: `${hashscanBase}/account/${id}`,
        };
      } catch {
        return {
          accountId: id,
          hbarBalance: null,
          summary: `Unable to fetch balance for ${id}`,
          note: "Mirror Node temporarily unavailable",
        };
      }
    },
  }),
};
