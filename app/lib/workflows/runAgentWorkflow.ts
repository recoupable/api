import { getWritable } from "workflow";
import type { UIMessage, UIMessageChunk } from "ai";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";
import type { AgentContext } from "@/lib/agent/tools/utils";

export type RunAgentWorkflowInput = {
  messages: UIMessage[];
  chatId: string;
  sessionId: string;
  modelId: string;
  /**
   * Threaded into `streamText`'s `experimental_context` so tools (bash et al.)
   * can read sandbox state + per-prompt Recoup creds.
   */
  agentContext: AgentContext;
};

/**
 * Vercel Workflow that drives the chat agent loop. The route handler calls
 * `start(runAgentWorkflow, [...])` and pipes `run.getReadable()` back to the
 * client; this function writes UIMessage chunks into the workflow's writable
 * via `runAgentStep`.
 *
 * Currently runs a SINGLE `runAgentStep` turn. Tool-call iteration (up to
 * MAX_TOOL_STEPS) happens INSIDE `streamText` via `stopWhen` — so the
 * single workflow turn covers the full "user → assistant → tool → tool
 * result → assistant" cycle without our outer loop having to thread
 * messages between iterations.
 *
 * WDK constraints honored:
 *   - All I/O (streamText, sandbox.exec, fetches) lives in `"use step"` functions.
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
    agentContext: input.agentContext,
  });

  console.log("[runAgentWorkflow] finish", { finishReason: result.finishReason });
}
