import { RegistryBrokerClient } from "@hashgraphonline/standards-sdk";

export interface DiscoveredAgent {
  uaid: string;
  name: string;
  capabilities: string[];
  endpoint?: string;
  trustScore?: number;
}

// Circuit breaker + cache to avoid repeated slow/failed registry calls
interface CacheEntry { result: DiscoveredAgent[]; expiresAt: number; }
interface CircuitState { failures: number; nextRetryAt: number; }

// Use globalThis to persist state across Turbopack HMR module reloads in dev mode.
// Plain module-level Maps reset on every reload, defeating the circuit breaker.
const g = globalThis as typeof globalThis & {
  _regClient?: RegistryBrokerClient | null;
  _regCache?: Map<string, CacheEntry>;
  _regCircuit?: Map<string, CircuitState>;
};
g._regCache   ??= new Map();
g._regCircuit ??= new Map();

const _cache   = g._regCache;
const _circuit = g._regCircuit;

function getClient(): RegistryBrokerClient {
  if (!g._regClient) {
    g._regClient = new RegistryBrokerClient({
      apiKey: process.env.REGISTRY_BROKER_API_KEY,
    });
  }
  return g._regClient;
}

const CACHE_TTL_MS   = 5 * 60 * 1000; // cache successful results for 5 minutes
const FAIL_THRESHOLD = 3;              // open circuit after 3 consecutive failures
const COOLDOWN_MS    = 60 * 1000;      // wait 60s before retrying after circuit opens

// Discover specialist agents in the HOL Registry by capability
export async function findAgentsByCapability(
  capability: string,
  limit = 5
): Promise<DiscoveredAgent[]> {
  const now = Date.now();

  // 1. Return from cache if still valid
  const cached = _cache.get(capability);
  if (cached && cached.expiresAt > now) return cached.result;

  // 2. Circuit open — skip HTTP call entirely
  const state = _circuit.get(capability) ?? { failures: 0, nextRetryAt: 0 };
  if (state.failures >= FAIL_THRESHOLD && state.nextRetryAt > now) {
    return [];
  }

  // 3. Attempt discovery with a 3s timeout
  try {
    const client = getClient();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Registry timeout")), 3000)
    );
    const results = await Promise.race([
      client.search({ q: capability, capabilities: [capability], limit }),
      timeout,
    ]);

    const discovered = (results.hits ?? []).map((hit) => ({
      uaid: hit.uaid,
      name: hit.profile?.display_name || hit.uaid,
      capabilities: (hit.profile as { aiAgent?: { capabilities?: string[] } })?.aiAgent?.capabilities || [],
      trustScore: (hit as unknown as { trustScore?: number }).trustScore,
    }));

    // Success — cache result and reset circuit
    _cache.set(capability, { result: discovered, expiresAt: now + CACHE_TTL_MS });
    _circuit.delete(capability);
    return discovered;

  } catch {
    const newFailures = state.failures + 1;
    if (newFailures === FAIL_THRESHOLD) {
      console.warn(`[Registry] Circuit open for "${capability}" — skipping discovery for ${COOLDOWN_MS / 1000}s`);
    }
    g._regClient = null; // reset so next attempt gets a fresh connection
    _circuit.set(capability, {
      failures: newFailures,
      nextRetryAt: newFailures >= FAIL_THRESHOLD ? now + COOLDOWN_MS : 0,
    });
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
