import { NextRequest } from "next/server";
import { runMarketAnalysis } from "@/lib/agents/market-analyst";
import { logToHCS } from "@/lib/hedera/hcs";

export async function POST(req: NextRequest) {
  try {
    const { requestId, paymentTxId } = await req.json();

    const analysis = await runMarketAnalysis("hedera-hashgraph");

    // Log analysis to HCS
    await logToHCS({
      type: "MARKET_ANALYSIS",
      action: `Market Analyst: ${analysis.recommendation} (score ${analysis.compositeScore}/100)`,
      reasoning: `${analysis.volatilityAssessment} ${analysis.sentimentSummary}`,
      requestId,
      paymentTxId,
      compositeScore: analysis.compositeScore,
      volatilityRegime: analysis.volatility.regime,
      fearGreedValue: analysis.sentiment.fearGreedValue,
    });

    return Response.json({
      success: true,
      requestId,
      analysis,
    });
  } catch (err) {
    console.error("[Market Analyst] Error:", err);
    return Response.json(
      { success: false, error: "Market analysis failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Health check
  return Response.json({
    agent: "Hive Market Analyst",
    status: "online",
    accountId: process.env.MARKET_AGENT_ACCOUNT_ID || "not configured",
    capabilities: ["analytics", "market-data", "sentiment", "volatility"],
  });
}
