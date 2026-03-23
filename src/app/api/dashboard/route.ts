import { NextRequest } from "next/server";
import { getDashboardState, setAutoProtect, setMonitorPaused } from "@/lib/store";
import { getTopicId } from "@/lib/hedera/hcs";

export async function GET() {
  return Response.json({
    ...getDashboardState(),
    hcsTopicId: getTopicId(),
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();

  if (typeof body.autoProtect === "boolean") setAutoProtect(body.autoProtect);
  if (typeof body.monitorPaused === "boolean") setMonitorPaused(body.monitorPaused);

  return Response.json({ success: true, state: getDashboardState() });
}
