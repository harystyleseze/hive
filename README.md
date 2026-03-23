# Hive — Multi-Agent DeFi Economy on Hedera

> **Hedera Hello Future Apex 2026 · AI & Agents Track**

Hive is an autonomous multi-agent economy where AI agents **discover, hire, and pay each other in HBAR** to collaboratively manage DeFi strategy on Hedera. Every agent decision is logged permanently on-chain via HCS.

---

## What Hive Does

Three autonomous agents coordinate without human intervention:

| Agent | Role | Payment |
|-------|------|---------|
| **Orchestrator** | Coordinates strategy, executes chat commands | — |
| **Market Analyst** | Real-time volatility + sentiment analysis | 0.1 HBAR per cycle |
| **Risk Assessor** | Portfolio risk scoring + rebalance signals | 0.1 HBAR per cycle |

Every 30 seconds the Orchestrator:
1. **Discovers** agents via HOL Registry (agent-to-agent discovery, not hardcoded)
2. **Pays** Market Analyst 0.1 HBAR on-chain → receives market data
3. **Pays** Risk Assessor 0.1 HBAR on-chain → receives risk score
4. **Executes** Bonzo Finance operations (real testnet deposits/withdrawals)
5. **Logs** every decision to HCS with full reasoning — permanent, auditable, on Hashscan

---

## Architecture

```
User ↔ Dashboard / Chat
            │
            ▼
     Orchestrator Agent  ←── runs every 30s (MonitorPoller)
            │
   ┌────────┴──────────────────┐
   │   HOL Registry Search     │  discovers agents by capability tag
   └────────┬──────────────────┘
            │ pays 0.1 HBAR each
   ┌────────┴──────────────────┐
   │  Market Analyst Agent     │  CoinGecko volatility + Fear & Greed Index
   │  Risk Assessor Agent      │  portfolio risk scoring
   └────────┬──────────────────┘
            │
   ┌────────┴──────────────────┐
   │  Bonzo Finance Plugin     │  real APYs + deposits on testnet
   │  (HederaAIToolkit)        │  bonzo_market_data_tool, bonzo_deposit_tool, ...
   └────────┬──────────────────┘
            │ deposits > 100 HBAR
   ┌────────┴──────────────────┐
   │  Hedera Schedule Service  │  user co-signs before execution
   └────────┬──────────────────┘
            │
   ┌────────┴──────────────────┐
   │  HCS Audit Trail          │  every decision logged on-chain
   └───────────────────────────┘
```

### Hedera Primitives Used

| Primitive | Purpose |
|-----------|---------|
| **HBAR transfers** | Agent-to-agent micropayments (0.1 HBAR per hire) |
| **HCS (Hedera Consensus Service)** | Immutable audit trail — every decision, reasoning, and payment |
| **Hedera Schedule Service** | Large deposits proposed as scheduled txs requiring user co-sign |
| **Bonzo Finance Plugin** | Real DeFi lending operations on testnet via `@bonzofinancelabs/hak-bonzo-plugin` |
| **HOL Registry** | Agent discovery — Orchestrator finds agents by capability, not by hardcoded address |
| **Mirror Node** | Balance checks, EVM address resolution |

---

## Demo Flow

### Dashboard (`/dashboard`)
- MonitorPoller auto-fires `POST /api/monitor` every 30 seconds
- Watch the **Agent Network** panel show live HBAR payment transactions
- **Risk Monitor** updates with composite risk score (0–100) and risk grade
- **HCS Feed** shows every agent decision with Hashscan links
- If risk > 85 and Auto-Protect is ON: autonomous withdrawal executes automatically

### Chat (`/chat`)
Try these prompts with the Orchestrator:

```
hire the market analyst
```
→ Pays 0.1 HBAR on-chain, shows HOL Registry UAID, returns live market data

```
hire the risk assessor
```
→ Pays 0.1 HBAR, returns portfolio risk score and recommendation

```
get bonzo markets
```
→ Calls `bonzo_market_data_tool` — real APYs from Bonzo testnet contracts

```
propose a 50 HBAR deposit into the best vault
```
→ Creates a Hedera Scheduled Transaction to the Bonzo lending pool (`0.0.4999355`), requires your co-sign

```
check my balance
```
→ Queries Hedera Mirror Node for live HBAR balance

---

## Setup

### Prerequisites
- Node.js 18+
- 3 Hedera testnet accounts ([portal.hedera.com](https://portal.hedera.com))
- HBAR from the testnet faucet
- OpenAI API key

### 1. Install

```bash
cd hive
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
# Orchestrator Agent (primary account — needs ~5 HBAR for payments + gas)
HEDERA_ACCOUNT_ID=0.0.XXXXX
HEDERA_PRIVATE_KEY=302e...   # DER-encoded ECDSA key

# Market Analyst Agent (receives 0.1 HBAR per cycle)
MARKET_AGENT_ACCOUNT_ID=0.0.YYYYY
MARKET_AGENT_PRIVATE_KEY=302e...

# Risk Assessor Agent (receives 0.1 HBAR per cycle)
RISK_AGENT_ACCOUNT_ID=0.0.ZZZZZ
RISK_AGENT_PRIVATE_KEY=302e...

# OpenAI
OPENAI_API_KEY=sk-...

# HOL Registry (get at https://hol.org/registry/dashboard)
REGISTRY_BROKER_API_KEY=rbk_...

# Leave blank — auto-created on first monitor run
HCS_DECISION_LOG_TOPIC=

# App URL (for agent registration endpoints)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# HOL Registry UAIDs (output from: npx tsx scripts/register-agents.ts)
ORCHESTRATOR_UAID=
MARKET_ANALYST_UAID=
RISK_ASSESSOR_UAID=

# Public account IDs for UI display
NEXT_PUBLIC_HEDERA_ACCOUNT_ID=0.0.XXXXX
NEXT_PUBLIC_MARKET_AGENT_ACCOUNT_ID=0.0.YYYYY
NEXT_PUBLIC_RISK_AGENT_ACCOUNT_ID=0.0.ZZZZZ

# Network: "testnet" (default) or "mainnet"
HEDERA_NETWORK=testnet
NEXT_PUBLIC_HEDERA_NETWORK=testnet

# Tunable parameters (defaults shown — override to customise)
AGENT_PAYMENT_HBAR=0.1
AUTO_PROTECT_THRESHOLD=85
REBALANCE_THRESHOLD=65
SCHEDULED_TX_THRESHOLD_HBAR=100
BONZO_LENDING_POOL_ID=0.0.4999355
OPENAI_MODEL=gpt-4o
HEDERA_MAX_TX_FEE_HBAR=2
AUTONOMOUS_MODE=false
AUTO_REBALANCE_AMOUNT_HBAR=5
```

### 3. Register agents in HOL Registry (one-time)

```bash
npx tsx scripts/register-agents.ts
```

This registers all 3 agents with their capability tags so the Orchestrator can discover them via `findAgentsByCapability()`.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/          # Orchestrator LLM endpoint (GPT-4o + Bonzo tools)
│   │   ├── monitor/       # 30s autonomous cycle: discover → pay → analyze → log
│   │   ├── agents/
│   │   │   ├── market/    # Market Analyst HTTP endpoint (POST = analyze, GET = health)
│   │   │   └── risk/      # Risk Assessor HTTP endpoint
│   │   ├── approve/       # User approve/reject action cards
│   │   └── dashboard/     # Dashboard state API
│   ├── dashboard/         # Agent network, risk panel, HCS feed
│   └── chat/              # Orchestrator chat interface
├── lib/
│   ├── agents/
│   │   ├── orchestrator-tools.ts   # AI SDK tools: hireMarketAnalyst, hireRiskAssessor, proposeBonzoDeposit
│   │   ├── market-analyst.ts       # CoinGecko + Fear & Greed analysis
│   │   ├── risk-assessor.ts        # Risk scoring engine
│   │   └── registry.ts             # HOL Registry discovery
│   ├── bonzo/
│   │   └── plugin.ts               # HederaAIToolkit + bonzoPlugin init
│   └── hedera/
│       ├── client.ts               # Hedera SDK client
│       ├── hcs.ts                  # HCS topic create + message submit
│       ├── hts.ts                  # HBAR transfer (agent payments)
│       └── schedule.ts             # Hedera Schedule Service
└── components/
    └── dashboard/
        ├── agent-network.tsx       # Live agent activity + payment feed
        ├── hcs-feed.tsx            # HCS audit log with Hashscan links
        └── risk-panel.tsx          # Risk score + pending action cards
```

---

## Key Technical Details

**Agent-to-agent payments** use `TransferTransaction` from `@hashgraph/sdk` — real HBAR moves on testnet every cycle. Payment transaction IDs are logged to HCS and displayed in the UI with Hashscan links.

**HOL Registry discovery** calls `RegistryBrokerClient.search({ capabilities: ["market-data"] })` before each hire. The Orchestrator doesn't hardcode agent addresses — it discovers them the same way any external agent would.

**Bonzo Finance integration** uses `HederaAIToolkit` with `bonzoPlugin` from `@bonzofinancelabs/hak-bonzo-plugin`. The chat Orchestrator has access to 6 Bonzo tools: `bonzo_market_data_tool`, `bonzo_deposit_tool`, `bonzo_withdraw_tool`, `approve_erc20_tool`, `bonzo_borrow_tool`, `bonzo_repay_tool`.

**Large deposit protection**: Any deposit > 100 HBAR is proposed as a `ScheduleCreateTransaction`. The UI shows the pending action card; the user must click Approve (which submits `ScheduleSignTransaction`) before funds move.

**HCS topic auto-creation**: If `HCS_DECISION_LOG_TOPIC` is not set, a new topic is created on first run and all subsequent messages go to that topic. The topic ID is surfaced in the dashboard header with a direct Hashscan link.
