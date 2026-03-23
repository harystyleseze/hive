// HCS-10 inbound topic format. External agents can submit messages to this
// topic directly on Hedera. The monitor loop polls for new messages via the
import { TopicCreateTransaction } from "@hashgraph/sdk";
import { getHederaClient } from "./client";
import { mirrorNodeBase, hashscanBase } from "./network";

const HCS10_INBOX_MEMO = "hcs-10:0:86400:1";

let cachedInboxTopicId: string | null = process.env.HCS10_INBOX_TOPIC || null;
let lastProcessedSequence = 0;

export function getInboxTopicId(): string | null {
  return cachedInboxTopicId;
}

export function getLastProcessedSequence(): number {
  return lastProcessedSequence;
}

export function setLastProcessedSequence(seq: number): void {
  lastProcessedSequence = seq;
}

export function getInboxHashscanUrl(topicId: string): string {
  return `${hashscanBase}/topic/${topicId}`;
}

/** Creates the HCS-10 inbound topic on first call; returns cached ID thereafter. */
export async function ensureHCS10InboxTopic(): Promise<string> {
  if (cachedInboxTopicId) return cachedInboxTopicId;

  const client = getHederaClient();
  const tx = await new TopicCreateTransaction()
    .setTopicMemo(HCS10_INBOX_MEMO)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const topicId = receipt.topicId!.toString();
  cachedInboxTopicId = topicId;
  // Persist for the current process lifetime
  process.env.HCS10_INBOX_TOPIC = topicId;
  console.log(`[HCS-10] Inbox topic created: ${topicId} — add HCS10_INBOX_TOPIC=${topicId} to .env.local`);
  return topicId;
}

export interface InboxMessage {
  sequenceNumber: number;
  /** Decoded message content (unwrapped from HCS-10 envelope if present) */
  data: string;
  sender: string;
  consensusTimestamp: string;
}

// Polls the Mirror Node for new messages on the inbox topic since the last
// processed sequence number. Handles both plain-text and HCS-10 envelope
// format (`{ p: "hcs-10", op: "message", data: "..." }`).
 
export async function pollInboxMessages(
  topicId: string,
  afterSequence: number
): Promise<InboxMessage[]> {
  const url = `${mirrorNodeBase}/topics/${topicId}/messages?sequenceNumber.gt=${afterSequence}&limit=25&order=asc`;

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const json = await res.json();
  const messages: InboxMessage[] = [];

  for (const msg of (json.messages ?? [])) {
    try {
      // Mirror Node returns message bytes as base64
      const raw = Buffer.from(msg.message as string, "base64").toString("utf-8");
      let data = raw;

      // Unwrap HCS-10 envelope if present
      try {
        const parsed = JSON.parse(raw);
        if (parsed.p === "hcs-10" && typeof parsed.data === "string") {
          data = parsed.data;
        } else if (parsed.p === "hcs-10" && parsed.data) {
          data = JSON.stringify(parsed.data);
        }
      } catch {
        // Not JSON — treat as plain text command
      }

      messages.push({
        sequenceNumber: msg.sequence_number as number,
        data,
        sender: (msg.chunk_info?.payer_account_id as string | undefined) ?? "unknown",
        consensusTimestamp: msg.consensus_timestamp as string,
      });
    } catch {
      // Skip malformed messages
    }
  }

  return messages;
}
