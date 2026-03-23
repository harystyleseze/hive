import { RegistryBrokerClient } from "@hashgraphonline/standards-sdk";

let _client: RegistryBrokerClient | null = null;

function getClient(): RegistryBrokerClient {
  if (!_client) {
    _client = new RegistryBrokerClient({
      apiKey: process.env.REGISTRY_BROKER_API_KEY,
    });
  }
  return _client;
}

export interface DiscoveredAgent {
  uaid: string;
  name: string;
  capabilities: string[];
  endpoint?: string;
  trustScore?: number;
}


// Discover specialist agents in the HOL Registry by capability
export async function findAgentsByCapability(
  capability: string,
  limit = 5
): Promise<DiscoveredAgent[]> {
  try {
    const client = getClient();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Registry timeout")), 3000)
    );
    const results = await Promise.race([
      client.search({ q: capability, capabilities: [capability], limit }),
      timeout,
    ]);

    return (results.hits ?? []).map((hit) => ({
      uaid: hit.uaid,
      name: hit.profile?.display_name || hit.uaid,
      capabilities: (hit.profile as { aiAgent?: { capabilities?: string[] } })?.aiAgent?.capabilities || [],
      trustScore: (hit as unknown as { trustScore?: number }).trustScore,
    }));
  } catch (err) {
    console.error("[Registry] Discovery failed:", err);
    return [];
  }
}


// Register an agent in the HOL Registry
export async function registerAgent(params: {
  displayName: string;
  bio: string;
  capabilities: string[];
  endpoint: string;
  model?: string;
}): Promise<{ uaid: string } | null> {
  try {
    const client = getClient();
    const profile = {
      version: "1.0.0",
      type: 1 as const,
      display_name: params.displayName,
      bio: params.bio,
      aiAgent: {
        type: "openai" as const,
        model: params.model || "gpt-4o",
        capabilities: params.capabilities,
      },
    };

    const registration = await client.registerAgent({
      profile,
      registry: "hashgraph-online",
      protocol: "aid" as const,
      endpoint: params.endpoint,
      metadata: {
        project: "Hive",
        hackathon: "Hedera Hello Future Apex 2026",
      },
    });

    return { uaid: registration.uaid ?? "" };
  } catch (err) {
    console.error("[Registry] Registration failed:", err);
    return null;
  }
}

// Get the agent registry stats
export async function getRegistryStats() {
  try {
    const client = getClient();
    return await client.stats();
  } catch {
    return null;
  }
}
