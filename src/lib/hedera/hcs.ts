import {
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicId,
} from "@hashgraph/sdk";
import { getHederaClient } from "./client";
import { hashscanBase } from "./network";
import { setHCSTopicId } from "@/lib/store";

// Auto-persisted topic ID for this server session
let cachedTopicId: string | null = process.env.HCS_DECISION_LOG_TOPIC || null;

export function getTopicId(): string | null {
  return cachedTopicId;
}

export async function createTopic(memo?: string): Promise<{ topicId: string }> {
  const client = getHederaClient();

  const tx = await new TopicCreateTransaction()
    .setTopicMemo(memo || "Hive Agent Decision Log")
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const topicId = receipt.topicId!.toString();
  return { topicId };
}

export async function submitMessage(
  topicId: string,
  message: string
): Promise<{ status: string; sequenceNumber?: number; transactionId: string }> {
  const client = getHederaClient();

  const tx = await new TopicMessageSubmitTransaction()
    .setTopicId(TopicId.fromString(topicId))
    .setMessage(message)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  return {
    status: receipt.status.toString(),
    sequenceNumber: receipt.topicSequenceNumber?.toNumber(),
    transactionId: tx.transactionId.toString(),
  };
}

export async function logToHCS(decision: {
  type: string;
  action: string;
  reasoning: string;
  [key: string]: unknown;
}): Promise<{
  logged: boolean;
  topicId: string;
  sequenceNumber?: number;
  transactionId?: string;
  hashscanUrl: string;
}> {
  // Auto-create topic if not configured
  if (!cachedTopicId) {
    try {
      const { topicId } = await createTopic("Hive Agent Decision Log");
      cachedTopicId = topicId;
      // Persist for this session
      process.env.HCS_DECISION_LOG_TOPIC = topicId;
      // Sync to store so dashboard API returns the topic ID
      setHCSTopicId(topicId);
      console.log(`[HCS] Auto-created topic: ${topicId}`);
    } catch (err) {
      console.error("[HCS] Failed to create topic:", err);
      return {
        logged: false,
        topicId: "",
        hashscanUrl: "",
      };
    }
  }

  const message = JSON.stringify({
    ...decision,
    timestamp: Date.now(),
    agent: "Hive",
    version: "1.0.0",
  });

  try {
    const result = await submitMessage(cachedTopicId, message);
    const hashscanUrl = `${hashscanBase}/topic/${cachedTopicId}`;
    return {
      logged: true,
      topicId: cachedTopicId,
      sequenceNumber: result.sequenceNumber,
      transactionId: result.transactionId,
      hashscanUrl,
    };
  } catch (err) {
    console.error("[HCS] Failed to submit message:", err);
    return {
      logged: false,
      topicId: cachedTopicId,
      hashscanUrl: `${hashscanBase}/topic/${cachedTopicId}`,
    };
  }
}

