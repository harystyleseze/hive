import { calculateVolatility, getVolatilityAssessment } from "@/lib/market/volatility";
import { analyzeSentiment, getSentimentSummary } from "@/lib/market/sentiment";
import type { VolatilityData, SentimentData } from "@/types";

export interface MarketAnalysis {
  volatility: VolatilityData;
  volatilityAssessment: string;
  sentiment: SentimentData;
  sentimentSummary: string;
  // 0-100, higher = more bullish / lower risk
  compositeScore: number; 
  recommendation: "DEPLOY" | "HOLD" | "REDUCE" | "PROTECT";
  timestamp: number;
}

// Market Analyst: analyzes real market conditions from 3 data sources.
// Called by the Orchestrator after paying 0.1 HBAR
export async function runMarketAnalysis(asset: string = "hedera-hashgraph"): Promise<MarketAnalysis> {
  const [volatility, sentiment] = await Promise.all([
    calculateVolatility(asset),
    analyzeSentiment(),
  ]);

  const volatilityAssessment = getVolatilityAssessment(volatility);
  const sentimentSummary = getSentimentSummary(sentiment);

  // Composite market health score (0-100, higher = better conditions)
  const volatilityScore = Math.max(0, 100 - volatility.volatility30d * 100);
  const sentimentScore = sentiment.overallScore * 100;
  const compositeScore = Math.round(0.5 * volatilityScore + 0.5 * sentimentScore);

  let recommendation: MarketAnalysis["recommendation"];
  if (compositeScore >= 65) recommendation = "DEPLOY";
  else if (compositeScore >= 45) recommendation = "HOLD";
  else if (compositeScore >= 25) recommendation = "REDUCE";
  else recommendation = "PROTECT";

  return {
    volatility,
    volatilityAssessment,
    sentiment,
    sentimentSummary,
    compositeScore,
    recommendation,
    timestamp: Date.now(),
  };
}
