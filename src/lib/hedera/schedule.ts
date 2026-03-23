import {
  ScheduleCreateTransaction,
  ScheduleDeleteTransaction,
  TransferTransaction,
  Hbar,
  AccountId,
  ScheduleId,
  ScheduleSignTransaction,
  ScheduleInfoQuery,
} from "@hashgraph/sdk";
import { getHederaClient } from "./client";
import { hashscanBase, mirrorNodeBase } from "./network";

export interface ScheduledDeposit {
  scheduleId: string;
  description: string;
  amount: number;
  token: string;
  vaultId: string;
  hashscanUrl: string;
  expiresAt: number;
}

// Propose a DeFi action as a Hedera Scheduled Transaction.
// The user must separately sign to execute it — agent never holds user keys. 
export async function proposeScheduledAction(
  description: string,
  amount: number,
  token: string,
  vaultId: string,
  recipientAccountId: string
): Promise<ScheduledDeposit> {
  const client = getHederaClient();
  const operatorId = process.env.HEDERA_ACCOUNT_ID!;

  // Inner transaction: HBAR transfer representing the deposit intent
  const innerTx = new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(operatorId), new Hbar(-amount))
    .addHbarTransfer(AccountId.fromString(recipientAccountId), new Hbar(amount))
    .setTransactionMemo(`Hive deposit: ${token} → ${vaultId}`);

  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  const scheduleTx = await new ScheduleCreateTransaction()
    .setScheduledTransaction(innerTx)
    .setScheduleMemo(description)
    .setAdminKey(client.operatorPublicKey!)
    .execute(client);

  const receipt = await scheduleTx.getReceipt(client);
  const scheduleId = receipt.scheduleId!.toString();

  return {
    scheduleId,
    description,
    amount,
    token,
    vaultId,
    hashscanUrl: `${hashscanBase}/schedule/${scheduleId}`,
    expiresAt,
  };
}

// Sign and execute a pending scheduled transaction.
// This simulates the user approval flow.
export async function executeScheduledAction(scheduleId: string): Promise<{
  transactionId: string;
  hashscanUrl: string;
}> {
  const client = getHederaClient();

  const tx = await new ScheduleSignTransaction()
    .setScheduleId(ScheduleId.fromString(scheduleId))
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const transactionId = tx.transactionId.toString();

  return {
    transactionId,
    hashscanUrl: `${hashscanBase}/transaction/${transactionId}`,
  };
}

// Delete (cancel) a pending scheduled transaction on-chain.
// Non-fatal if the schedule has already expired or been executed
export async function deleteScheduledTransaction(scheduleId: string): Promise<void> {
  const client = getHederaClient();
  const tx = await new ScheduleDeleteTransaction()
    .setScheduleId(ScheduleId.fromString(scheduleId))
    .execute(client);
  await tx.getReceipt(client);
}

// Get info about a scheduled transaction from Mirror Node
export async function getScheduleInfo(scheduleId: string) {
  try {
    const res = await fetch(
      `${mirrorNodeBase}/schedules/${scheduleId}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
