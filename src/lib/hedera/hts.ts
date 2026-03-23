import { TransferTransaction, Hbar, AccountId, TransactionId } from "@hashgraph/sdk";
import { getHederaClient } from "./client";
import { hashscanBase, mirrorNodeBase } from "./network";
import type { AgentPayment } from "@/types";

 // Pay another agent in HBAR for their service
 // Creates a real on-chain HBAR transfer transaction
export async function payAgent(
  toAccountId: string,
  hbarAmount: number,
  memo: string,
  toAgentLabel?: "market-analyst" | "risk-assessor"
): Promise<AgentPayment> {
  const client = getHederaClient();
  const fromAccountId = process.env.HEDERA_ACCOUNT_ID!;

  const tx = await new TransferTransaction()
    .setTransactionId(TransactionId.generate(AccountId.fromString(fromAccountId)))
    .addHbarTransfer(AccountId.fromString(fromAccountId), new Hbar(-hbarAmount))
    .addHbarTransfer(AccountId.fromString(toAccountId), new Hbar(hbarAmount))
    .setTransactionMemo(memo)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const transactionId = tx.transactionId.toString();

  return {
    id: `payment-${Date.now()}`,
    fromAgent: "orchestrator",
    toAgent: toAgentLabel ?? (toAccountId === process.env.MARKET_AGENT_ACCOUNT_ID ? "market-analyst" : "risk-assessor"),
    toAccountId,
    hbarAmount,
    memo,
    transactionId,
    hashscanUrl: `${hashscanBase}/transaction/${transactionId}`,
    timestamp: Date.now(),
  };
}


// Get HBAR balance for an account via Mirror Node
export async function getHbarBalance(accountId: string): Promise<number> {
  try {
    const res = await fetch(
      `${mirrorNodeBase}/accounts/${accountId}`
    );
    if (!res.ok) return 0;
    const data = await res.json();
    // tinybars to HBAR
    return (data.balance?.balance ?? 0) / 1e8; 
  } catch {
    return 0;
  }
}
