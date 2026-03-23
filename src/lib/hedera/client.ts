import { Client, PrivateKey, AccountId, Hbar } from "@hashgraph/sdk";
import { hederaNetwork } from "./network";
import { config } from "@/lib/config";

// Orchestrator (primary) client
let _client: Client | null = null;

export function getHederaClient(): Client {
  if (!_client) {
    const accountId = process.env.HEDERA_ACCOUNT_ID;
    const privateKey = process.env.HEDERA_PRIVATE_KEY;

    if (!accountId || !privateKey) {
      throw new Error("HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set");
    }

    _client = hederaNetwork === "mainnet" ? Client.forMainnet() : Client.forTestnet();
    _client.setOperator(
      AccountId.fromString(accountId),
      PrivateKey.fromStringDer(privateKey)
    );
    _client.setDefaultMaxTransactionFee(new Hbar(config.hederaMaxTxFeeHbar));
  }
  return _client;
}

export function getOperatorAccountId(): string {
  return process.env.HEDERA_ACCOUNT_ID || "0.0.0";
}

// Create a client for a specific agent (for specialist agents that have their own accounts)
export function getAgentClient(accountId: string, privateKey: string): Client {
  const client = hederaNetwork === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(
    AccountId.fromString(accountId),
    PrivateKey.fromStringDer(privateKey)
  );
  client.setDefaultMaxTransactionFee(new Hbar(0.1));
  return client;
}
