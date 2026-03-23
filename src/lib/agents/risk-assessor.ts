import type { VaultPosition, RiskMetrics } from "@/types";
import type { MarketAnalysis } from "./market-analyst";
import { config } from "@/lib/config";

export interface RiskAssessment {
  // 0-100, higher = more risky
  compositeRisk: number; 
  riskGrade: "low" | "medium" | "high" | "critical";
  volatilityContribution: number;
  sentimentContribution: number;
  portfolioConcentrationRisk: number;
  recommendation: string;
  shouldProtect: boolean;
  shouldRebalance: boolean;
  timestamp: number;
}


// Risk Assessor: scores current portfolio risk given market conditions.
// Called by the Orchestrator after paying 0.1 HBAR. 
export function runRiskAssessment(
  marketAnalysis: MarketAnalysis,
  positions: VaultPosition[]
): RiskAssessment {
  const { volatility, sentiment } = marketAnalysis;

  // Volatility risk (0-100): high vol = high risk
  const volatilityRisk = Math.min(100, volatility.volatility30d * 100);

  // Sentiment risk (0-100): bearish = high risk
  const sentimentRisk = (1 - sentiment.overallScore) * 100;

  // Portfolio concentration risk (0-100)
  const portfolioConcentrationRisk = calculateConcentrationRisk(positions);

  // Weighted composite risk
  const compositeRisk = Math.round(
    0.40 * volatilityRisk +
    0.35 * sentimentRisk +
    0.25 * portfolioConcentrationRisk
  );

  const riskGrade = scoreToGrade(compositeRisk);
  const shouldProtect = compositeRisk >= config.autoProtectThreshold;
  const shouldRebalance = compositeRisk >= config.rebalanceThreshold && compositeRisk < config.autoProtectThreshold;

  let recommendation: string;
  if (shouldProtect) {
    recommendation = `CRITICAL: Risk score ${compositeRisk}/100. Recommend immediate withdrawal from aggressive positions. Auto-protect will execute if enabled.`;
  } else if (shouldRebalance) {
    recommendation = `HIGH RISK: Score ${compositeRisk}/100. Consider moving ${Math.round((compositeRisk - 50) * 2)}% of aggressive positions to conservative vaults.`;
  } else if (compositeRisk >= 40) {
    recommendation = `MODERATE: Score ${compositeRisk}/100. Current allocations are within acceptable parameters. Monitor closely.`;
  } else {
    recommendation = `LOW RISK: Score ${compositeRisk}/100. Conditions favorable. Consider deploying idle capital into yield-bearing positions.`;
  }

  return {
    compositeRisk,
    riskGrade,
    volatilityContribution: Math.round(volatilityRisk),
    sentimentContribution: Math.round(sentimentRisk),
    portfolioConcentrationRisk: Math.round(portfolioConcentrationRisk),
    recommendation,
    shouldProtect,
    shouldRebalance,
    timestamp: Date.now(),
  };
}

function calculateConcentrationRisk(positions: VaultPosition[]): number {
  if (positions.length === 0) return 0;
  if (positions.length === 1) return 60; // fully concentrated

  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  if (totalValue === 0) return 0;

  // Herfindahl-Hirschman Index for concentration
  const hhi = positions.reduce((sum, p) => {
    const share = p.currentValue / totalValue;
    return sum + share * share;
  }, 0);

  // HHI ranges from 1/n (equal) to 1 (fully concentrated)
  // Normalize to 0-100
  return Math.round(hhi * 100);
}

function scoreToGrade(score: number): RiskAssessment["riskGrade"] {
  if (score < 30) return "low";
  if (score < 60) return "medium";
  if (score < config.autoProtectThreshold) return "high";
  return "critical";
}

export function buildRiskMetrics(
  assessment: RiskAssessment,
  marketAnalysis: MarketAnalysis
): RiskMetrics {
  return {
    volatility: Math.round(marketAnalysis.volatility.volatility30d * 100),
    volatilityRegime: marketAnalysis.volatility.regime,
    sentimentScore: marketAnalysis.sentiment.overallScore,
    sentimentLabel: marketAnalysis.sentiment.label,
    compositeRisk: assessment.compositeRisk,
    riskGrade: assessment.riskGrade,
    timestamp: Date.now(),
  };
}
