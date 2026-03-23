import { NextRequest } from "next/server";
import { getBonzoTools } from "@/lib/bonzo/plugin";
import { logToHCS } from "@/lib/hedera/hcs";
import { removePosition, addHCSLogEntry } from "@/lib/store";

export async function POST(req: NextRequest) {
  const { vaultId, tokenSymbol, amount, withdrawAll } = await req.json();

  if (!tokenSymbol) {
    return Response.json({ success: false, error: "tokenSymbol is required" }, { status: 400 });
  }

  try {
    const withdrawTool = getBonzoTools()["bonzo_withdraw_tool"];

    let txResult: unknown = null;
    if (withdrawTool?.execute) {
      txResult = await withdrawTool.execute(
        {
          required: { tokenSymbol, amount: withdrawAll ? 0 : (amount ?? 0) },
          optional: { withdrawAll: withdrawAll ?? false },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { toolCallId: crypto.randomUUID(), messages: [] } as any
      );
    }

    if (vaultId) removePosition(vaultId);

    const action = withdrawAll
      ? `Withdrew all ${tokenSymbol} from vault ${vaultId ?? "unknown"}`
      : `Withdrew ${amount} ${tokenSymbol} from vault ${vaultId ?? "unknown"}`;

    const hcsResult = await logToHCS({
      type: "WITHDRAWAL",
      action,
      reasoning: "User-initiated withdrawal via dashboard",
      vaultId,
      tokenSymbol,
      amount,
      withdrawAll,
      txResult,
    });

    addHCSLogEntry({
      id: `hcs-withdraw-${Date.now()}`,
      type: "USER_APPROVAL",
      action,
      reasoning: "User-initiated exit from position",
      timestamp: Date.now(),
      sequenceNumber: hcsResult.sequenceNumber,
      hashscanUrl: hcsResult.hashscanUrl,
      topicId: hcsResult.topicId,
      status: hcsResult.logged ? "logged" : "simulated",
    });

    return Response.json({ success: true, txResult, hcs: { logged: hcsResult.logged, hashscanUrl: hcsResult.hashscanUrl } });
  } catch (err) {
    console.error("[Withdraw] Error:", err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}
