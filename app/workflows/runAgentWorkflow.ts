import { getWritable } from "workflow";
import type { UIMessage, UIMessageChunk } from "ai";
import { runAgentStep } from "@/app/workflows/runAgentStep";

export type RunAgentWorkflowInput = {
  messages: UIMessage[];
  chatId: string;
  sessionId: string;
  modelId: string;
  /** Cap on the number of LLM turns. Open-agents defaults to 500; without tools we never iterate past 1. */
  maxSteps?: number;
};

const DEFAULT_MAX_STEPS = 500;

/**
 * Vercel Workflow that drives the chat agent loop. The route handler calls
 * `start(runAgentWorkflow, [...])` and pipes `run.getReadable()` back to the
 * client; this function writes UIMessage chunks into the workflow's writable
 * via `runAgentStep`.
 *
 * Slim implementation: a single `runAgentStep` invocation with no tools.
 * The loop shape (and break-on-finishReason logic) is in place so the tool
 * port PR can switch from "1 turn → done" to "N turns → done when not
 * tool-calls" without touching this signature.
 *
 * WDK constraints honored:
 *   - All I/O (streamText, fetches) lives in `"use step"` functions.
 *   - The workflow body only orchestrates — no fetch / setTimeout / fs / crypto.
 */
export async function runAgentWorkflow(input: RunAgentWorkflowInput): Promise<void> {
  "use workflow";

  console.log("[runAgentWorkflow] start", {
    chatId: input.chatId,
    sessionId: input.sessionId,
    modelId: input.modelId,
  });

  const writable = getWritable<UIMessageChunk>();
  const maxSteps = input.maxSteps ?? DEFAULT_MAX_STEPS;

  for (let step = 0; step < maxSteps; step++) {
    const result = await runAgentStep({
      messages: input.messages,
      modelId: input.modelId,
      writable,
    });

    if (result.finishReason !== "tool-calls") {
      console.log("[runAgentWorkflow] finish", { step, finishReason: result.finishReason });
      break;
    }
  }
}
