import { getWritable } from "workflow";
import type { UIMessage, UIMessageChunk } from "ai";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";

export type RunAgentWorkflowInput = {
  messages: UIMessage[];
  chatId: string;
  sessionId: string;
  modelId: string;
};

/**
 * Vercel Workflow that drives the chat agent loop. The route handler calls
 * `start(runAgentWorkflow, [...])` and pipes `run.getReadable()` back to the
 * client; this function writes UIMessage chunks into the workflow's writable
 * via `runAgentStep`.
 *
 * Currently runs a SINGLE `runAgentStep` turn. A multi-turn agent loop is
 * unsafe today: each iteration would re-send the original prompt without
 * the assistant's tool-call response in scope, so a `tool-calls` finish
 * reason would loop forever on the same input. The proper multi-turn
 * shape (where the step appends its response to `messages` before the
 * next iteration) lands with the sandbox-tool port in PR 4.
 *
 * Until then, if the model returns `tool-calls` we log a warning and exit
 * — the client receives the partial tool-call chunks but no follow-up turn.
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
  const result = await runAgentStep({
    messages: input.messages,
    modelId: input.modelId,
    writable,
  });

  if (result.finishReason === "tool-calls") {
    console.warn(
      "[runAgentWorkflow] model returned tool-calls but tool execution is not wired yet; exiting after 1 turn",
      { chatId: input.chatId },
    );
  } else {
    console.log("[runAgentWorkflow] finish", { finishReason: result.finishReason });
  }
}
