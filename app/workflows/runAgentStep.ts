import { streamText, convertToModelMessages, type UIMessage, type UIMessageChunk } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { agentCustomInstructions } from "@/lib/chat/agentCustomInstructions";

export type RunAgentStepInput = {
  messages: UIMessage[];
  modelId: string;
  writable: WritableStream<UIMessageChunk>;
};

/**
 * One LLM turn in the chat workflow agent loop. Runs as a Vercel Workflow
 * `"use step"` so that:
 *
 *   - Sandbox-banned APIs (`fetch`, `setTimeout`, `crypto`) are legal inside.
 *   - The result is cached as a single durable event — replays after a crash
 *     do not re-bill the model.
 *
 * Currently emits a plain text response with no tools. Sandbox tools land in
 * the follow-up PR (port `@open-harness/agent` tools + wire via
 * `experimental_context`).
 *
 * @param input - Messages + selected model + the workflow's writable stream.
 * @returns finishReason from the model run (for the workflow loop's break condition).
 */
export async function runAgentStep(input: RunAgentStepInput): Promise<{ finishReason: string }> {
  "use step";

  console.log("[runAgentStep] start", {
    modelId: input.modelId,
    messageCount: input.messages.length,
  });

  const modelMessages = convertToModelMessages(input.messages);
  const result = streamText({
    model: gateway(input.modelId),
    system: agentCustomInstructions,
    messages: modelMessages,
  });

  for await (const part of result.toUIMessageStream()) {
    const writer = input.writable.getWriter();
    await writer.write(part);
    writer.releaseLock();
  }

  const finishReason = await result.finishReason;
  console.log("[runAgentStep] finish", { finishReason });
  return { finishReason };
}
