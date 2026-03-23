/**
 * One-time script to register Hive agents in the HOL Registry.
 *
 * Prerequisites:
 *   1. Set REGISTRY_BROKER_API_KEY in .env.local
 *   2. Set NEXT_PUBLIC_APP_URL to your deployed/tunneled URL
 *
 * Run with:
 *   npx tsx scripts/register-agents.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { RegistryBrokerClient } from "@hashgraphonline/standards-sdk";

async function main() {
  const apiKey = process.env.REGISTRY_BROKER_API_KEY;
  if (!apiKey) {
    console.error("ERROR: REGISTRY_BROKER_API_KEY not set in .env.local");
    console.log("Get your key at https://hol.org/registry/dashboard");
    console.log("Or run: npx @hol-org/registry claim");
    process.exit(1);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const client = new RegistryBrokerClient({ apiKey });

  const agents = [
    {
      display_name: "Hive Orchestrator",
      bio: "Autonomous DeFi strategy coordinator on Hedera. Discovers and hires specialist agents (Market Analyst, Risk Assessor) in HBAR micropayments to optimize Bonzo Finance vault positions. All decisions logged to HCS.",
      capabilities: ["defi", "coordination", "hbar-payments", "hcs-logging"],
      endpoint: `${appUrl}/api/chat`,
    },
    {
      display_name: "Hive Market Analyst",
      bio: "Real-time market analysis agent on Hedera. Provides volatility data (CoinGecko), sentiment analysis (Fear & Greed Index), and Hedera Mirror Node on-chain activity signals. Accepts HBAR payment per analysis.",
      capabilities: ["analytics", "market-data", "sentiment", "volatility"],
      endpoint: `${appUrl}/api/agents/market`,
    },
    {
      display_name: "Hive Risk Assessor",
      bio: "Portfolio risk scoring agent on Hedera. Evaluates DeFi position risk using market conditions, volatility regime, and portfolio concentration. Accepts HBAR payment per risk assessment.",
      capabilities: ["risk-assessment", "defi", "portfolio-analysis"],
      endpoint: `${appUrl}/api/agents/risk`,
    },
  ];

  console.log("Registering Hive agents in HOL Registry...\n");

  for (const agent of agents) {
    try {
      console.log(`Registering: ${agent.display_name}`);

      const registration = await client.registerAgent({
        profile: {
          version: "1.0.0",
          type: 1,
          display_name: agent.display_name,
          bio: agent.bio,
          aiAgent: {
            type: "openai",
            model: "gpt-4o",
            capabilities: agent.capabilities,
          },
        },
        registry: "hashgraph-online",
        protocol: "aid",
        endpoint: agent.endpoint,
        metadata: {
          project: "Hive",
          hackathon: "Hedera Hello Future Apex 2026",
          track: "AI & Agents",
          hedera_network: "testnet",
        },
      });

      console.log(`  ✓ UAID: ${registration.uaid}`);
      console.log(`  ✓ Endpoint: ${agent.endpoint}`);
      console.log();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const body = (err as { body?: unknown }).body;
      console.error(`  ✗ Failed to register ${agent.display_name}: ${msg}`);
      if (body) console.error("    Response:", JSON.stringify(body, null, 2));
      console.log();
    }
  }

  console.log("Done! Add the UAIDs to your store via setAgentUaids()");
  console.log("or set them in .env.local as ORCHESTRATOR_UAID, MARKET_ANALYST_UAID, RISK_ASSESSOR_UAID");
}

main();
