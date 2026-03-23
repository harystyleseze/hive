import type { VolatilityData } from "@/types";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export async function fetchCurrentPrice(
  asset: string = "hedera-hashgraph"
): Promise<{ price: number; change24h: number }> {
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=${asset}&vs_currencies=usd&include_24hr_change=true`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) return { price: 0.08, change24h: -1.2 };

    const data = await res.json();
    const assetKey = asset.replace(/-/g, "_");
    const assetData = data[assetKey] || data[asset];

    return {
      price: assetData?.usd || 0.08,
      change24h: assetData?.usd_24h_change || 0,
    };
  } catch {
    return { price: 0.08, change24h: -1.2 };
  }
}

export async function calculateVolatility(
  asset: string = "hedera-hashgraph"
): Promise<VolatilityData> {
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/${asset}/market_chart?vs_currency=usd&days=30`,
      { next: { revalidate: 300 } }
    );

    if (!res.ok) return getSimulatedVolatility(asset);

    const data = await res.json();
    const prices: number[] = data.prices.map((p: [number, number]) => p[1]);

    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const dailyVol = Math.sqrt(variance);
    const annualizedVol = dailyVol * Math.sqrt(365);

    const currentPrice = prices[prices.length - 1];
    const priceChange24h =
      ((currentPrice - prices[prices.length - 2]) / prices[prices.length - 2]) * 100;

    return {
      asset,
      currentPrice,
      priceChange24h,
      volatility30d: annualizedVol,
      regime: classifyVolatilityRegime(annualizedVol),
      timestamp: Date.now(),
    };
  } catch {
    return getSimulatedVolatility(asset);
  }
}

function classifyVolatilityRegime(
  vol: number
): "low" | "medium" | "high" | "extreme" {
  if (vol < 0.3) return "low";
  if (vol < 0.6) return "medium";
  if (vol < 1.0) return "high";
  return "extreme";
}

function getSimulatedVolatility(asset: string): VolatilityData {
  return {
    asset,
    currentPrice: 0.08,
    priceChange24h: -1.2,
    volatility30d: 0.52,
    regime: "medium",
    timestamp: Date.now(),
  };
}

export function getVolatilityAssessment(data: VolatilityData): string {
  const descriptions = {
    low: "Market is calm. Good conditions for deploying capital.",
    medium: "Moderate volatility. Standard conditions — proceed with normal allocations.",
    high: "High volatility. Consider reducing exposure or moving to safer positions.",
    extreme: "Extreme volatility. Recommend defensive positioning — stablecoins or withdrawal.",
  };
  return `${descriptions[data.regime]} ${data.asset} price: $${data.currentPrice.toFixed(4)}, 24h: ${data.priceChange24h.toFixed(2)}%, 30d vol: ${(data.volatility30d * 100).toFixed(1)}%.`;
}
