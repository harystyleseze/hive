import { openai } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";
import { streamText, stepCountIs } from "ai";
import { orchestratorTools } from "@/lib/agents/orchestrator-tools";
import { getBonzoTools } from "@/lib/bonzo/plugin";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "@/lib/system-prompt";
import { config } from "@/lib/config";

export const maxDuration = 60;

function getModel() {
  if (process.env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
    return groq(config.openaiModel);
  }
  return openai(config.openaiModel);
}

export async function POST(req: Request) {
  const { messages } = await req.json();

  // useChat (TextStreamChatTransport) sends UIMessages with `parts`.
  // streamText expects CoreMessages with `content`.
  const coreMessages = (messages as Array<Record<string, unknown>>).map((msg) => {
    if (msg.content !== undefined) return msg;
    const parts = (msg.parts as Array<{ type: string; text?: string }>) ?? [];
    const content = parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("");
    return { role: msg.role, content };
  });

  const result = streamText({
    model: getModel(),
    system: ORCHESTRATOR_SYSTEM_PROMPT,
    messages: coreMessages,
    tools: { ...orchestratorTools, ...getBonzoTools() },
    stopWhen: stepCountIs(10),
    temperature: 0.1,
  });

  return result.toTextStreamResponse();
}
