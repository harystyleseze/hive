import type {
  ActionCard,
  HCSLogEntry,
  RiskMetrics,
  AgentStatus,
  VaultPosition,
  AgentPayment,
  AgentHire,
} from "@/types";

interface HiveStore {
  // DeFi positions
  positions: VaultPosition[];
  actionCards: ActionCard[];

  // Audit trail
  hcsLog: HCSLogEntry[];
  hcsTopicId: string | null;
  hcsMessageCount: number;

  // Agent economy
  agentPayments: AgentPayment[];
  agentHires: AgentHire[];
  totalHbarPaid: number;

  // Risk & status
  riskMetrics: RiskMetrics | null;
  agentStatus: AgentStatus;
  lastMonitorRun: number;
  autoProtectEnabled: boolean;
  monitorPaused: boolean;

  // HOL Registry UAIDs (set after registration)
  orchestratorUaid: string | null;
  marketAnalystUaid: string | null;
  riskAssessorUaid: string | null;
}

const store: HiveStore = {
  positions: [],
  actionCards: [],
  hcsLog: [],
  hcsTopicId: null,
  hcsMessageCount: 0,
  agentPayments: [],
  agentHires: [],
  totalHbarPaid: 0,
  riskMetrics: null,
  agentStatus: "monitoring",
  lastMonitorRun: 0,
  autoProtectEnabled: process.env.AUTONOMOUS_MODE === "true",
  monitorPaused: false,
  orchestratorUaid: null,
  marketAnalystUaid: null,
  riskAssessorUaid: null,
};

// position

export function getPositions(): VaultPosition[] {
  const now = Date.now();
  return store.positions.map(p => ({
    ...p,
    currentValue: p.depositedAmount * (1 + (p.apy / 100) * ((now - p.depositTimestamp) / (365 * 24 * 3600 * 1000))),
  }));
}
export function addPosition(p: VaultPosition): void {
  const idx = store.positions.findIndex((x) => x.vaultId === p.vaultId);
  if (idx >= 0) store.positions[idx] = p;
  else store.positions.push(p);
}
export function removePosition(vaultId: string): void {
  store.positions = store.positions.filter((p) => p.vaultId !== vaultId);
}

// action cards

export function getActionCards(): ActionCard[] { return [...store.actionCards]; }
export function getPendingActions(): ActionCard[] {
  return store.actionCards.filter((a) => a.status === "pending");
}
export function addActionCard(card: ActionCard): void {
  store.actionCards.unshift(card);
  if (store.actionCards.length > 20) store.actionCards = store.actionCards.slice(0, 20);
}
export function updateActionCard(id: string, updates: Partial<ActionCard>): ActionCard | null {
  const idx = store.actionCards.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  store.actionCards[idx] = { ...store.actionCards[idx], ...updates };
  return store.actionCards[idx];
}

// hcs logs

export function getHCSLog(): HCSLogEntry[] { return [...store.hcsLog]; }
export function addHCSLogEntry(entry: HCSLogEntry): void {
  store.hcsLog.unshift(entry);
  store.hcsMessageCount++;
  if (store.hcsLog.length > 50) store.hcsLog = store.hcsLog.slice(0, 50);
}
export function getHCSTopicId(): string | null { return store.hcsTopicId; }
export function setHCSTopicId(topicId: string): void { store.hcsTopicId = topicId; }
export function getHCSMessageCount(): number { return store.hcsMessageCount; }

// agent economy

export function getAgentPayments(): AgentPayment[] { return [...store.agentPayments]; }
export function addAgentPayment(payment: AgentPayment): void {
  store.agentPayments.unshift(payment);
  store.totalHbarPaid += payment.hbarAmount;
  if (store.agentPayments.length > 100) store.agentPayments = store.agentPayments.slice(0, 100);
}
export function getTotalHbarPaid(): number { return store.totalHbarPaid; }

export function getAgentHires(): AgentHire[] { return [...store.agentHires]; }
export function addAgentHire(hire: AgentHire): void {
  store.agentHires.unshift(hire);
  if (store.agentHires.length > 50) store.agentHires = store.agentHires.slice(0, 50);
}

// risk and status

export function getRiskMetrics(): RiskMetrics | null { return store.riskMetrics; }
export function setRiskMetrics(metrics: RiskMetrics): void { store.riskMetrics = metrics; }

export function getAgentStatus(): AgentStatus { return store.agentStatus; }
export function setAgentStatus(status: AgentStatus): void { store.agentStatus = status; }

export function getLastMonitorRun(): number { return store.lastMonitorRun; }
export function setLastMonitorRun(t: number): void { store.lastMonitorRun = t; }

export function isAutoProtectEnabled(): boolean { return store.autoProtectEnabled; }
export function setAutoProtect(enabled: boolean): void { store.autoProtectEnabled = enabled; }

export function isMonitorPaused(): boolean { return store.monitorPaused; }
export function setMonitorPaused(paused: boolean): void { store.monitorPaused = paused; }

// HOL Registry UAIDs 

export function setAgentUaids(uaids: { orchestrator?: string; marketAnalyst?: string; riskAssessor?: string }): void {
  if (uaids.orchestrator) store.orchestratorUaid = uaids.orchestrator;
  if (uaids.marketAnalyst) store.marketAnalystUaid = uaids.marketAnalyst;
  if (uaids.riskAssessor) store.riskAssessorUaid = uaids.riskAssessor;
}

export function getAgentUaids() {
  return {
    orchestrator: store.orchestratorUaid,
    marketAnalyst: store.marketAnalystUaid,
    riskAssessor: store.riskAssessorUaid,
  };
}

// Dashboard Snapshot 

export function getDashboardState() {
  return {
    positions: getPositions(),
    actionCards: getActionCards(),
    pendingActions: getPendingActions(),
    hcsLog: getHCSLog(),
    hcsTopicId: store.hcsTopicId,
    hcsMessageCount: store.hcsMessageCount,
    agentPayments: store.agentPayments.slice(0, 10),
    totalHbarPaid: store.totalHbarPaid,
    agentHires: store.agentHires.slice(0, 10),
    riskMetrics: store.riskMetrics,
    agentStatus: store.agentStatus,
    lastMonitorRun: store.lastMonitorRun,
    autoProtectEnabled: store.autoProtectEnabled,
    monitorPaused: store.monitorPaused,
    agentUaids: getAgentUaids(),
  };
}
