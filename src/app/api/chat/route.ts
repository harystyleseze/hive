import { openai } from "@ai-sdk/openai";
import { streamText, stepCountIs } from "ai";
import { orchestratorTools } from "@/lib/agents/orchestrator-tools";
import { getBonzoTools } from "@/lib/bonzo/plugin";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "@/lib/system-prompt";
import { config } from "@/lib/config";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai(config.openaiModel),
    system: ORCHESTRATOR_SYSTEM_PROMPT,
    messages,
    tools: { ...orchestratorTools, ...getBonzoTools() },
    stopWhen: stepCountIs(10),
    temperature: 0.1,
  });

  return result.toTextStreamResponse();
}
