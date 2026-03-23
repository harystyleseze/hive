import { NextRequest } from "next/server";
import { executeScheduledAction, deleteScheduledTransaction } from "@/lib/hedera/schedule";
import { logToHCS } from "@/lib/hedera/hcs";
import { updateActionCard, addHCSLogEntry } from "@/lib/store";

export async function POST(req: NextRequest) {
  const { actionId, scheduleId } = await req.json();

  try {
    let txResult;

    if (scheduleId) {
      // Execute a Hedera Scheduled Transaction
      txResult = await executeScheduledAction(scheduleId);
    }

    // Update action card status
    const updated = updateActionCard(actionId, {
      status: "executed",
      hashscanUrl: txResult?.hashscanUrl,
    });

    // Log approval to HCS
    const hcsResult = await logToHCS({
      type: "USER_APPROVAL",
      action: `User approved action ${actionId}`,
      reasoning: "User reviewed and signed the proposed action",
      actionId,
      scheduleId,
      transactionId: txResult?.transactionId,
    });

    addHCSLogEntry({
      id: `hcs-approve-${Date.now()}`,
      type: "USER_APPROVAL",
      action: `Approved: ${updated?.type} ${updated?.amount} ${updated?.token}`,
      reasoning: "User explicitly approved this action",
      timestamp: Date.now(),
      txHash: txResult?.transactionId,
      sequenceNumber: hcsResult.sequenceNumber,
      hashscanUrl: hcsResult.hashscanUrl,
      topicId: hcsResult.topicId,
      status: hcsResult.logged ? "logged" : "simulated",
    });

    return Response.json({
      success: true,
      action: updated,
      transaction: txResult,
      hcs: { logged: hcsResult.logged, hashscanUrl: hcsResult.hashscanUrl },
    });
  } catch (err) {
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { actionId, scheduleId } = await req.json();

  if (scheduleId) {
    try {
      await deleteScheduledTransaction(scheduleId);
    } catch (err) {
      console.error("[Approve] Schedule delete failed (may already be expired):", err);
    }
  }

  const updated = updateActionCard(actionId, { status: "rejected" });

  await logToHCS({
    type: "USER_REJECTION",
    action: `User rejected action ${actionId}`,
    reasoning: "User declined the proposed action",
    actionId,
  });

  return Response.json({ success: true, action: updated });
}
