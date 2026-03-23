// Script to register (or re-register) Hive agents in the HOL Registry
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { RegistryBrokerClient } from "@hashgraphonline/standards-sdk";

async function main() {
  const apiKey = process.env.REGISTRY_BROKER_API_KEY;
  if (!apiKey) {
    console.error("ERROR: REGISTRY_BROKER_API_KEY not set in .env.local");
    console.log("Get your key at https://hol.org/registry/dashboard");
    process.exit(1);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const hcs10InboxTopic = process.env.HCS10_INBOX_TOPIC || "";

  // Warn about common misconfigurations
  if (appUrl.includes("localhost")) {
    console.warn("⚠  NEXT_PUBLIC_APP_URL is localhost — agents will be registered with a localhost endpoint.");
    console.warn("   Set NEXT_PUBLIC_APP_URL=https://your-app.vercel.app in .env.local for production.\n");
  }
  if (!hcs10InboxTopic) {
    console.warn("⚠  HCS10_INBOX_TOPIC not set — Orchestrator will be registered WITHOUT an HCS-10 inbound topic.");
    console.warn("   Run the app first, copy the topic ID from console, then re-run this script.\n");
  }

  const client = new RegistryBrokerClient({ apiKey });

  const agents = [
    {
      display_name: "Hive Orchestrator",
      envKey: "ORCHESTRATOR_UAID",
      bio: "Autonomous DeFi strategy coordinator on Hedera. Discovers and hires specialist agents (Market Analyst, Risk Assessor) in HBAR micropayments to optimize Bonzo Finance vault positions. Reachable via HCS-10 inbound topic or HTTP. All decisions logged to HCS.",
      capabilities: ["defi", "coordination", "hbar-payments", "hcs-logging", "hcs-10"],
      endpoint: `${appUrl}/api/chat`,
      inboundTopicId: hcs10InboxTopic,
    },
    {
      display_name: "Hive Market Analyst",
      envKey: "MARKET_ANALYST_UAID",
      bio: "Real-time market analysis agent on Hedera. Provides volatility data (CoinGecko), sentiment analysis (Fear & Greed Index), and Hedera Mirror Node on-chain activity signals. Accepts HBAR payment per analysis.",
      capabilities: ["analytics", "market-data", "sentiment", "volatility"],
      endpoint: `${appUrl}/api/agents/market`,
    },
    {
      display_name: "Hive Risk Assessor",
      envKey: "RISK_ASSESSOR_UAID",
      bio: "Portfolio risk scoring agent on Hedera. Evaluates DeFi position risk using market conditions, volatility regime, and portfolio concentration. Accepts HBAR payment per risk assessment.",
      capabilities: ["risk-assessment", "defi", "portfolio-analysis"],
      endpoint: `${appUrl}/api/agents/risk`,
    },
  ];

  console.log(`Registering Hive agents in HOL Registry...`);
  console.log(`Endpoint base: ${appUrl}\n`);

  const results: Array<{ envKey: string; uaid: string | null }> = [];

  for (const agent of agents) {
    console.log(`Registering: ${agent.display_name}`);
    let uaid: string | null = null;

    try {
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
          ...(agent.inboundTopicId ? { hcs10_inbound_topic: agent.inboundTopicId } : {}),
        },
      });

      uaid = registration.uaid ?? null;
      console.log(`  ✓ UAID: ${uaid}`);
      console.log(`  ✓ Endpoint: ${agent.endpoint}`);
      if (agent.inboundTopicId) {
        console.log(`  ✓ HCS-10 Inbox: ${agent.inboundTopicId}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // RegistryBrokerParseError: registration may have succeeded server-side
      // even though the SDK's Zod schema rejects the response format
      const rawValue = (err as { rawValue?: Record<string, unknown> }).rawValue;
      if (rawValue?.uaid) {
        uaid = rawValue.uaid as string;
        const status = rawValue.status ?? "unknown";
        console.log(`  ✓ UAID: ${uaid} (status: ${status} — SDK parse error suppressed)`);
        console.log(`  ✓ Endpoint: ${agent.endpoint}`);
        if (agent.inboundTopicId) {
          const meta = rawValue.metadata as Record<string, unknown> | undefined;
          const topicInMeta = meta?.hcs10_inbound_topic;
          if (topicInMeta) {
            console.log(`  ✓ HCS-10 Inbox: ${topicInMeta}`);
          } else {
            console.warn(`  ⚠  HCS-10 Inbox NOT in metadata — server may have deduplicated without updating`);
          }
        }
      } else {
        console.error(`  ✗ Registration failed: ${msg}`);
        if (rawValue) console.error("    Server response:", JSON.stringify(rawValue, null, 2));
      }
    }

    results.push({ envKey: agent.envKey, uaid });
    console.log();
  }

  // Print ready-to-copy .env.local block
  console.log("─".repeat(60));
  console.log("Copy these UAIDs into .env.local and your Vercel env vars:");
  console.log("─".repeat(60));
  for (const { envKey, uaid } of results) {
    if (uaid) {
      console.log(`${envKey}=${uaid}`);
    } else {
      console.log(`${envKey}=  # registration failed — check errors above`);
    }
  }
  console.log("─".repeat(60));
}

main();
