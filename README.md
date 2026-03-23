# Hive — Multi-Agent DeFi Economy on Hedera

Hive is an autonomous multi-agent economy where AI agents **discover, hire, and pay each other in HBAR** to collaboratively manage DeFi strategy on Hedera. Every agent decision is logged permanently on-chain via Hedera Consensus Service (HCS)

---

## What Hive Does

Three autonomous agents coordinate without human intervention:

| Agent | Role | Payment |
|-------|------|---------|
| **Orchestrator** | Coordinates strategy, executes chat commands | — |
| **Market Analyst** | Real-time volatility + sentiment analysis | 0.1 HBAR per cycle |
| **Risk Assessor** | Portfolio risk scoring + rebalance signals | 0.1 HBAR per cycle |

Every 30 seconds the Orchestrator:
1. **Checks HCS-10 inbox** — reads any messages sent by external agents to the Orchestrator's public HCS topic
2. **Discovers** agents via HOL Registry (agent-to-agent discovery, not hardcoded)
3. **Pays** Market Analyst 0.1 HBAR on-chain → receives market data
4. **Pays** Risk Assessor 0.1 HBAR on-chain → receives risk score
5. **Executes** Bonzo Finance operations (real testnet deposits/withdrawals)
6. **Logs** every decision to HCS with full reasoning — permanent, auditable, on Hashscan

---

## Architecture

Hive has two independent execution paths sharing the same state and Hedera infrastructure:

```
External Agents ──► HCS-10 Inbox Topic (Hedera)
                           │
User ↔ Dashboard / Chat    │ (polled each cycle)
              │             │
   ┌──────────┴─────────────┴──┐
   │                           │
Monitor Loop (every 30s)     Chat Agent (on demand)
                         GPT-4o / Groq
   │                            │
   ├─ Poll HCS-10 inbox         ├─ hireMarketAnalyst tool → 0.1 HBAR
   ├─ HOL Registry discovery    ├─ hireRiskAssessor tool → 0.1 HBAR
   ├─ Pay Market Analyst        ├─ getBonzoMarkets tool
   ├─ Pay Risk Assessor         └─ proposeBonzoDeposit tool
   ├─ Score portfolio risk                  │
   │                                        ▼
   │  risk ≥ 85:                       Action Card
   │    auto-protect withdrawal    (human approves, or
   │  65 ≤ risk < 85:               Schedule Service for
   │    AUTONOMOUS_MODE=true ──►    deposits > 100 HBAR)
   │      execute deposit
   │    AUTONOMOUS_MODE=false ──►
   │      create action card
   │
   └────────────── shared in-memory store ─────────────
                  positions · hcsLog · riskMetrics
                             │
                      Hedera Network
              HBAR transfers · HCS · HCS-10 · Bonzo Finance
              HOL Registry · Mirror Node · Schedule Service
```

## Operating Modes

Hive supports two modes controlled by a single env var:

### Co-pilot mode (`AUTONOMOUS_MODE=false`, default)

The agent proposes, the human decides.

- Monitor loop creates **action cards** for rebalance signals → you approve on dashboard
- Chat deposits always create action cards → you approve before funds move
- Deposits ≥ 100 HBAR use **Hedera Schedule Service** — you co-sign before execution
- Auto-protect only triggers if you toggle it ON in the dashboard header

### Autonomous mode (`AUTONOMOUS_MODE=true`)

The agent decides and executes without waiting.

- **Auto-protect is ON by default** at startup — no toggle needed
- Monitor detects risk 65–84 → deposits directly into a conservative Bonzo vault (no card)
- Monitor detects risk ≥ 85 → withdraws all aggressive positions automatically
- Every autonomous action logged to HCS with `isAutonomous: true` and displayed with an `AUTONOMOUS` badge in the HCS feed
- Chat proposals still create action cards (the chat path is unchanged)
- Hedera Schedule Service is still enforced for large chat deposits — even autonomous mode respects Hedera's protocol-level co-sign requirement

---

### Hedera Primitives Used

| Primitive | Purpose |
|-----------|---------|
| **HBAR transfers** | Agent-to-agent micropayments (0.1 HBAR per hire) |
| **HCS (Hedera Consensus Service)** | Immutable audit trail — every decision, reasoning, and payment |
| **HCS-10** | Orchestrator exposes a public inbound topic — external agents can message it directly on Hedera |
| **Hedera Schedule Service** | Large deposits proposed as scheduled txs requiring user co-sign |
| **Bonzo Finance Plugin** | Real DeFi lending operations on testnet via `@bonzofinancelabs/hak-bonzo-plugin` |
| **HOL Registry** | Agent discovery — Orchestrator finds agents by capability |
| **Mirror Node** | Balance checks, EVM address resolution, HCS-10 inbox polling |

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
propose a 150 HBAR deposit into the best vault
```
→ Creates a Hedera Scheduled Transaction (>100 HBAR threshold) — requires your co-sign before funds move

```
propose a 50 HBAR deposit into the best vault
```
→ Creates an action card on the dashboard — approve on dashboard to execute (below Schedule Service threshold)

```
check my balance
```
→ Queries Hedera Mirror Node for live HBAR balance

---

## Setup

### Prerequisites
- Node.js 18+
- 3 Hedera testnet accounts ([portal.hedera.com](https://portal.hedera.com))
- HBAR from the testnet faucet ([portal.hedera.com/faucet](https://portal.hedera.com/faucet)) — Orchestrator needs ~5 HBAR
- OpenAI API key (or Groq — free, set `OPENAI_MODEL=llama-3.3-70b-versatile` with `@ai-sdk/groq`)

> **No OpenAI key yet?** The dashboard works fully without one — monitor loop, HBAR payments, HCS logging, and risk scoring all run with zero LLM. Only the `/chat` page requires an API key.

### 1. Install

```bash
git clone https://github.com/harystyleseze/hive
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

# HCS-10 inbound topic for external agent messaging (auto-created on first monitor run)
# Copy the logged topic ID here after first run, then re-run register-agents.ts
HCS10_INBOX_TOPIC=

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

### 3b. Set up HCS-10 inbox (after first `npm run dev`)

On first monitor cycle, the app auto-creates the HCS-10 inbox topic and logs the ID:
```
[HCS-10] Inbox topic created: 0.0.XXXXX — add HCS10_INBOX_TOPIC=0.0.XXXXX to .env.local
```

Copy that ID to `.env.local`, then re-run agent registration so the HOL Registry knows the Orchestrator's HCS-10 endpoint:
```bash
npx tsx scripts/register-agents.ts
```

External agents can then message the Orchestrator by submitting to topic `0.0.XXXXX` on Hedera — messages appear in the HCS Feed with a `HCS-10` badge.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**First run checklist:**
```
✓ Open http://localhost:3000/dashboard
✓ Wait 30s — Agent Network panel fills with payment entries + Hashscan links
✓ HCS Feed shows MONITOR_CYCLE entry with Hashscan link ↗
✓ Risk score appears in the Risk Monitor panel
✓ HCS topic ID shown in feed header — click to verify on Hashscan
✓ Console logs HCS-10 inbox topic: copy HCS10_INBOX_TOPIC=0.0.XXXXX to .env.local
✓ Re-run: npx tsx scripts/register-agents.ts (adds HCS-10 topic to HOL Registry entry)
✓ Open /chat → try "hire the market analyst"
✓ GET /api/hcs-inbox → shows inbox topic ID + Hashscan link
```

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── agents/
│   │   │   ├── market/route.ts      # Market Analyst HTTP endpoint
│   │   │   └── risk/route.ts        # Risk Assessor HTTP endpoint
│   │   ├── approve/route.ts         # Approve / reject action cards
│   │   ├── chat/route.ts            # Orchestrator LLM endpoint (GPT-4o + Bonzo tools)
│   │   ├── dashboard/route.ts       # Dashboard state (GET snapshot / PATCH toggles)
│   │   ├── hcs-inbox/route.ts       # HCS-10 inbox — GET status, POST to poll + process
│   │   ├── monitor/route.ts         # 30s autonomous cycle: inbox → discover → pay → analyze → log
│   │   └── withdraw/route.ts        # Position withdrawal
│   ├── chat/page.tsx                # Chat interface
│   ├── dashboard/page.tsx           # Agent network, risk panel, HCS feed
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                     # Landing page
├── components/
│   ├── chat/
│   │   └── chat-panel.tsx           # Streaming chat UI with tool call indicators
│   ├── dashboard/
│   │   ├── agent-network.tsx        # Live agent activity + payment feed
│   │   ├── hcs-feed.tsx             # HCS audit log with Hashscan links
│   │   ├── positions-list.tsx       # Vault positions + withdraw buttons
│   │   └── risk-panel.tsx           # Risk score + pending action cards
│   ├── layout/
│   │   └── header.tsx               # Auto-protect toggle + monitor pause
│   └── providers.tsx
└── lib/
    ├── agents/
    │   ├── market-analyst.ts        # CoinGecko volatility + Fear & Greed analysis
    │   ├── orchestrator-tools.ts    # 6 AI SDK tools (hire, propose, log, balance)
    │   ├── registry.ts              # HOL Registry discovery (findAgentsByCapability)
    │   └── risk-assessor.ts         # Risk scoring engine (0–100 composite)
    ├── bonzo/
    │   └── plugin.ts                # HederaAIToolkit + bonzoPlugin initialisation
    ├── hedera/
    │   ├── client.ts                # Hedera SDK client singleton
    │   ├── hcs.ts                   # HCS topic auto-create + message submit
    │   ├── hcs10-inbox.ts           # HCS-10 inbound topic creation + Mirror Node polling
    │   ├── hts.ts                   # HBAR transfers (agent payments)
    │   ├── network.ts               # Network URLs derived from HEDERA_NETWORK
    │   └── schedule.ts              # Hedera Schedule Service (large deposit proposals)
    ├── market/
    │   ├── sentiment.ts             # Fear & Greed + Mirror Node on-chain signals
    │   └── volatility.ts            # CoinGecko 30-day volatility
    ├── client-config.ts             # NEXT_PUBLIC_ vars for browser components
    ├── config.ts                    # Tunable business parameters (thresholds, amounts)
    ├── store.ts                     # In-memory app state (positions, HCS log, metrics)
    ├── system-prompt.ts             # Orchestrator system prompt
    └── types/index.ts               # Shared TypeScript types
```

---

## Key Technical Details

**Agent-to-agent payments** use `TransferTransaction` from `@hashgraph/sdk` — real HBAR moves on testnet every cycle. Payment transaction IDs are logged to HCS and displayed in the UI with Hashscan links.

**HOL Registry discovery** calls `RegistryBrokerClient.search({ capabilities: ["market-data"] })` before each hire. The Orchestrator doesn't hardcode agent addresses — it discovers them the same way any external agent would.

**Bonzo Finance integration** uses `HederaAIToolkit` with `bonzoPlugin` from `@bonzofinancelabs/hak-bonzo-plugin`. The chat Orchestrator has access to 6 Bonzo tools: `bonzo_market_data_tool`, `bonzo_deposit_tool`, `bonzo_withdraw_tool`, `approve_erc20_tool`, `bonzo_borrow_tool`, `bonzo_repay_tool`.

**Large deposit protection**: Any deposit > 100 HBAR is proposed as a `ScheduleCreateTransaction`. The UI shows the pending action card; the user must click Approve (which submits `ScheduleSignTransaction`) before funds move.

**HCS topic auto-creation**: If `HCS_DECISION_LOG_TOPIC` is not set, a new topic is created on first run and all subsequent messages go to that topic. The topic ID is surfaced in the dashboard header with a direct Hashscan link.

**HCS-10 inbound topic**: The Orchestrator exposes a public HCS topic as its HCS-10 inbox (memo: `hcs-10:0:86400:1`). Any external agent on Hedera can submit a message to this topic — the monitor loop polls it every 30 seconds via the Mirror Node REST API and logs each message to the HCS decision feed with a `HCS10_MESSAGE` type. The inbox topic ID is registered in the HOL Registry as `hcs10_inbound_topic` so external agents can discover it by capability search. Auto-created on first run — copy the logged ID to `HCS10_INBOX_TOPIC` in `.env.local`, then re-run `scripts/register-agents.ts`.
