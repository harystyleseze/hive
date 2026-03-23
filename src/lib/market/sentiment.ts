import type { SentimentData } from "@/types";
import { mirrorNodeBase } from "@/lib/hedera/network";

/**
 * Real sentiment analysis from 3 sources:
 * 1. Alternative.me Fear & Greed Index
 * 2. CoinGecko community sentiment votes
 * 3. Hedera Mirror Node recent transaction volume (on-chain activity signal)
 */
export async function analyzeSentiment(): Promise<SentimentData> {
  const [fearGreed, cgSentiment, mirrorSignal] = await Promise.allSettled([
    fetchFearGreedIndex(),
    fetchCoinGeckoSentiment(),
    fetchMirrorNodeSignal(),
  ]);

  const fg = fearGreed.status === "fulfilled" ? fearGreed.value : { value: 50, label: "Neutral" };
  const cg = cgSentiment.status === "fulfilled" ? cgSentiment.value : 0.5;
  const mirror = mirrorSignal.status === "fulfilled" ? mirrorSignal.value : 0.5;

  // Normalize fear & greed to 0-1 (higher = more bullish)
  const fgNorm = fg.value / 100;

  // Weighted composite score (0-1, higher = more bullish)
  const overallScore = 0.40 * fgNorm + 0.40 * cg + 0.20 * mirror;

  const label = scoreToLabel(overallScore);

  return {
    overallScore,
    fearGreedValue: fg.value,
    fearGreedLabel: fg.label,
    label,
    sources: [
      { name: "Fear & Greed Index", score: fgNorm, weight: 0.4 },
      { name: "CoinGecko Sentiment", score: cg, weight: 0.4 },
      { name: "Hedera On-Chain Activity", score: mirror, weight: 0.2 },
    ],
    timestamp: Date.now(),
  };
}

async function fetchFearGreedIndex(): Promise<{ value: number; label: string }> {
  const res = await fetch("https://api.alternative.me/fng/?limit=1", {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error("Fear & Greed API unavailable");
  const data = await res.json();
  return {
    value: Number(data.data[0].value),
    label: data.data[0].value_classification,
  };
}

async function fetchCoinGeckoSentiment(): Promise<number> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/coins/hedera-hashgraph?localization=false&tickers=false&market_data=false&community_data=true&developer_data=false",
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) throw new Error("CoinGecko API unavailable");
  const data = await res.json();
  const upPct = data.sentiment_votes_up_percentage ?? 50;
  return upPct / 100;
}

async function fetchMirrorNodeSignal(): Promise<number> {
  // Use recent transaction count on Hedera testnet as an on-chain activity signal
  const res = await fetch(
    `${mirrorNodeBase}/transactions?limit=100&order=desc&result=SUCCESS`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) throw new Error("Mirror Node unavailable");
  const data = await res.json();
  // More transactions = more activity = bullish signal
  const txCount = (data.transactions as unknown[])?.length ?? 0;
  return Math.min(txCount / 100, 1.0);
}

function scoreToLabel(score: number): SentimentData["label"] {
  if (score < 0.2) return "very_bearish";
  if (score < 0.4) return "bearish";
  if (score < 0.6) return "neutral";
  if (score < 0.8) return "bullish";
  return "very_bullish";
}

export function getSentimentSummary(data: SentimentData): string {
  const pct = (data.overallScore * 100).toFixed(0);
  return `Market sentiment: ${data.label.replace("_", " ")} (${pct}%). Fear & Greed: ${data.fearGreedValue}/100 (${data.fearGreedLabel}). Sources: Fear&Greed, CoinGecko, Hedera on-chain activity.`;
}
