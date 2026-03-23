import { NextRequest } from "next/server";
import { runRiskAssessment, buildRiskMetrics } from "@/lib/agents/risk-assessor";
import { logToHCS } from "@/lib/hedera/hcs";
import { getPositions } from "@/lib/store";
import type { MarketAnalysis } from "@/lib/agents/market-analyst";

export async function POST(req: NextRequest) {
  try {
    const { requestId, paymentTxId, marketAnalysis } = await req.json() as {
      requestId: string;
      paymentTxId?: string;
      marketAnalysis: MarketAnalysis;
    };

    const positions = getPositions();
    const assessment = runRiskAssessment(marketAnalysis, positions);
    const riskMetrics = buildRiskMetrics(assessment, marketAnalysis);

    // Log to HCS
    await logToHCS({
      type: "RISK_ASSESSMENT",
      action: `Risk Assessor: ${assessment.riskGrade.toUpperCase()} (${assessment.compositeRisk}/100)`,
      reasoning: assessment.recommendation,
      requestId,
      paymentTxId,
      compositeRisk: assessment.compositeRisk,
      riskGrade: assessment.riskGrade,
      shouldProtect: assessment.shouldProtect,
    });

    return Response.json({
      success: true,
      requestId,
      assessment,
      riskMetrics,
    });
  } catch (err) {
    console.error("[Risk Assessor] Error:", err);
    return Response.json(
      { success: false, error: "Risk assessment failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({
    agent: "Hive Risk Assessor",
    status: "online",
    accountId: process.env.RISK_AGENT_ACCOUNT_ID || "not configured",
    capabilities: ["risk-assessment", "defi", "portfolio-analysis"],
  });
}
