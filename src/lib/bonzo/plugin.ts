import { HederaAIToolkit, AgentMode } from "hedera-agent-kit";
import { bonzoPlugin } from "@bonzofinancelabs/hak-bonzo-plugin";
import { getHederaClient } from "@/lib/hedera/client";
import type { Tool } from "ai";

let _toolkit: HederaAIToolkit | null = null;

/**
 * Initialize HederaAIToolkit with the Bonzo Finance plugin and return
 * AI SDK v6-compatible tools. Lazy-initialized and cached.
 *
 * Provides: bonzo_market_data_tool, bonzo_deposit_tool, bonzo_withdraw_tool,
 *           approve_erc20_tool, bonzo_borrow_tool, bonzo_repay_tool
 */
export function getBonzoTools(): Record<string, Tool> {
  if (_toolkit) return _toolkit.getTools();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _toolkit = new HederaAIToolkit({
      client: getHederaClient() as any,
      configuration: {
        context: { mode: AgentMode.AUTONOMOUS },
        plugins: [bonzoPlugin],
      },
    });
    return _toolkit.getTools();
  } catch (err) {
    console.error("[Bonzo] Toolkit init failed (env vars may not be set):", err);
    return {};
  }
}
