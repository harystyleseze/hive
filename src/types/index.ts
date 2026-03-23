export type RiskLevel = "conservative" | "moderate" | "aggressive";
export type AgentStatus = "monitoring" | "analyzing" | "executing" | "offline";
export type ActionCardStatus = "pending" | "approved" | "rejected" | "executed";

export interface VolatilityData {
  asset: string;
  currentPrice: number;
  priceChange24h: number;
  volatility30d: number;
  regime: "low" | "medium" | "high" | "extreme";
  timestamp: number;
}

export interface SentimentData {
  // 0 to 1 (normalized)
  overallScore: number;
  // 0-100 raw
  fearGreedValue: number; 
  fearGreedLabel: string;
  label: "very_bearish" | "bearish" | "neutral" | "bullish" | "very_bullish";
  sources: { name: string; score: number; weight: number }[];
  timestamp: number;
}

export interface RiskMetrics {
  // 0-100
  volatility: number; 
  volatilityRegime: VolatilityData["regime"];
  // 0-1
  sentimentScore: number; 
  sentimentLabel: SentimentData["label"];
  // 0-100
  compositeRisk: number; 
  riskGrade: "low" | "medium" | "high" | "critical";
  timestamp: number;
}

export interface AgentPayment {
  id: string;
  fromAgent: string;
  toAgent: string;
  toAccountId: string;
  hbarAmount: number;
  memo: string;
  transactionId: string;
  hashscanUrl: string;
  timestamp: number;
}

export interface AgentHire {
  id: string;
  hiringAgent: string;
  hiredAgent: string;
  service: string;
  payment: AgentPayment;
  result: unknown;
  timestamp: number;
}

export interface HCSLogEntry {
  id: string;
  type: string;
  action: string;
  reasoning: string;
  timestamp: number;
  txHash?: string;
  sequenceNumber?: number;
  hashscanUrl?: string;
  topicId?: string;
  status: "logged" | "pending" | "simulated";
  isAutonomous?: boolean;
}

export interface ActionCard {
  id: string;
  type: "deposit" | "withdraw" | "rebalance";
  vault: string;
  vaultId: string;
  amount: number;
  token: string;
  apy: number;
  riskLevel: RiskLevel;
  reasoning: string;
  status: ActionCardStatus;
  createdAt: number;
  scheduleId?: string;
  hashscanUrl?: string;
  fromVault?: string;
  fromVaultId?: string;
}

export interface VaultPosition {
  vaultId: string;
  vaultName: string;
  protocol: string;
  depositedAmount: number;
  currentValue: number;
  apy: number;
  riskLevel: RiskLevel;
  depositTimestamp: number;
  tokenSymbol: string;
  transactionId?: string;
}

export interface HCSMessage {
  sequenceNumber: number;
  contents: string;
  consensusTimestamp: string;
  topicId: string;
}

export interface MonitorCycleResult {
  metrics: RiskMetrics;
  marketAnalysis: unknown;
  riskAssessment: unknown;
  payments: AgentPayment[];
  newActions: ActionCard[];
  hcsEntries: HCSLogEntry[];
  agentStatus: AgentStatus;
  timestamp: number;
}
