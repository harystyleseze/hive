import {
  ensureHCS10InboxTopic,
  getInboxTopicId,
  getInboxHashscanUrl,
  getLastProcessedSequence,
  pollInboxMessages,
  setLastProcessedSequence,
} from "@/lib/hedera/hcs10-inbox";
import { logToHCS } from "@/lib/hedera/hcs";
import { addHCSLogEntry } from "@/lib/store";

export async function GET() {
  const topicId = getInboxTopicId();
  return Response.json({
    topicId,
    hashscanUrl: topicId ? getInboxHashscanUrl(topicId) : null,
    lastSequence: getLastProcessedSequence(),
    instructions: topicId
      ? `Submit a message to topic ${topicId} on Hedera testnet to reach the Hive Orchestrator.`
      : "Inbox not initialised — call POST /api/monitor once to create the topic.",
  });
}

export async function POST() {
  try {
    const topicId = await ensureHCS10InboxTopic();
    const lastSeq = getLastProcessedSequence();
    const messages = await pollInboxMessages(topicId, lastSeq);

    if (messages.length === 0) {
      return Response.json({ processed: 0, topicId, lastSequence: lastSeq });
    }

    const results: { sequence: number; sender: string; preview: string }[] = [];

    for (const msg of messages) {
      const preview = msg.data.slice(0, 120);

      // Log each incoming HCS-10 message to the HCS decision audit trail
      const hcsResult = await logToHCS({
        type: "HCS10_MESSAGE",
        action: `HCS-10 message from ${msg.sender}`,
        reasoning: preview,
        inboxTopicId: topicId,
        sender: msg.sender,
        sequenceNumber: msg.sequenceNumber,
        consensusTimestamp: msg.consensusTimestamp,
      });

      addHCSLogEntry({
        id: `hcs10-${msg.sequenceNumber}-${Date.now()}`,
        type: "HCS10_MESSAGE",
        action: `HCS-10: ${msg.sender}`,
        reasoning: preview,
        timestamp: Date.now(),
        sequenceNumber: hcsResult.sequenceNumber,
        hashscanUrl: hcsResult.hashscanUrl,
        topicId: hcsResult.topicId,
        status: hcsResult.logged ? "logged" : "simulated",
      });

      setLastProcessedSequence(msg.sequenceNumber);
      results.push({ sequence: msg.sequenceNumber, sender: msg.sender, preview });
    }

    return Response.json({
      processed: messages.length,
      topicId,
      hashscanUrl: getInboxHashscanUrl(topicId),
      lastSequence: getLastProcessedSequence(),
      results,
    });
  } catch (err) {
    console.error("[HCS-10 Inbox] Error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
