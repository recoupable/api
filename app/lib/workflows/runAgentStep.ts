import { streamText, convertToModelMessages, type UIMessage, type UIMessageChunk } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { agentCustomInstructions } from "@/lib/chat/agentCustomInstructions";
import { CHAT_AGENT_STOP_WHEN } from "@/lib/chat/const";
import { buildAgentTools } from "@/lib/agent/buildAgentTools";
import type { AgentContext } from "@/lib/agent/tools/AgentContext";

export type RunAgentStepInput = {
  messages: UIMessage[];
  modelId: string;
  writable: WritableStream<UIMessageChunk>;
  /**
   * Threaded into `streamText`'s `experimental_context` so each tool's
   * `execute` callback can read the sandbox state + per-prompt context.
   */
  agentContext: AgentContext;
};

/**
 * One LLM turn (with internal tool-call iteration) in the chat workflow.
 * Runs as a Vercel Workflow `"use step"` so:
 *
 *   - Sandbox-banned APIs (`fetch`, `setTimeout`, `crypto`) are legal inside.
 *   - The result is cached as a single durable event — replays after a crash
 *     do not re-bill the model or re-execute tools.
 *
 * `streamText` drives the tool-call → tool-result → next-LLM-call loop
 * internally using its default stop condition. Our outer workflow stays
 * single-turn for now — multi-turn message threading lands when the rest
 * of the tool surface ports in a follow-up PR.
 *
 * @param input - Messages + selected model + writable stream + agent context.
 * @returns finishReason from the model run.
 */
export async function runAgentStep(input: RunAgentStepInput): Promise<{ finishReason: string }> {
  "use step";

  console.log("[runAgentStep] start", {
    modelId: input.modelId,
    messageCount: input.messages.length,
    hasSandboxState: Boolean(input.agentContext.sandbox?.state),
  });

  const modelMessages = convertToModelMessages(input.messages);
  const tools = buildAgentTools();
  const result = streamText({
    model: gateway(input.modelId),
    system: agentCustomInstructions,
    messages: modelMessages,
    tools,
    stopWhen: CHAT_AGENT_STOP_WHEN,
    experimental_context: input.agentContext,
  });

  // Acquire the writer once and release in `finally` so a thrown chunk
  // doesn't leak the lock.
  const writer = input.writable.getWriter();
  try {
    for await (const part of result.toUIMessageStream()) {
      await writer.write(part);
    }
  } finally {
    writer.releaseLock();
  }

  const finishReason = await result.finishReason;
  console.log("[runAgentStep] finish", { finishReason });
  return { finishReason };
}
