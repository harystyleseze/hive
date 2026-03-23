export const config = {
  /** HBAR paid to each specialist agent per hire cycle */
  agentPaymentHbar: parseFloat(process.env.AGENT_PAYMENT_HBAR || "0.1"),

  /** Risk score (0-100) above which auto-protect triggers emergency withdrawal */
  autoProtectThreshold: parseInt(process.env.AUTO_PROTECT_THRESHOLD || "85", 10),

  /** Risk score (0-100) above which a rebalance action card is proposed */
  rebalanceThreshold: parseInt(process.env.REBALANCE_THRESHOLD || "65", 10),

  /** HBAR deposit amount above which a Hedera Scheduled Transaction is used (requires user co-sign) */
  scheduledTxThresholdHbar: parseFloat(process.env.SCHEDULED_TX_THRESHOLD_HBAR || "100"),

  /** Bonzo Finance lending pool Hedera account ID (testnet: 0.0.4999355) */
  bonzoLendingPoolId: process.env.BONZO_LENDING_POOL_ID || "0.0.4999355",

  /** OpenAI model to use for the Orchestrator agent */
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o",

  /** Maximum Hedera transaction fee cap in HBAR */
  hederaMaxTxFeeHbar: parseFloat(process.env.HEDERA_MAX_TX_FEE_HBAR || "2"),

  /**
   * Autonomous mode: when true, Hive executes all decisions without human approval.
   * Auto-protect defaults ON, rebalances execute directly, deposits skip the action card.
   * false = co-pilot mode (human approves every action via the dashboard).
   */
  autonomousMode: process.env.AUTONOMOUS_MODE === "true",

  /** HBAR amount deployed per autonomous rebalance cycle (only used when AUTONOMOUS_MODE=true) */
  autoRebalanceAmountHbar: parseFloat(process.env.AUTO_REBALANCE_AMOUNT_HBAR || "5"),
} as const;
