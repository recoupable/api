import { getWorkflowMetadata, getWritable } from "workflow";
import type { UIMessage, UIMessageChunk } from "ai";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";
import { clearChatActiveStream } from "@/lib/chat/clearChatActiveStream";
import type { DurableAgentContext } from "@/lib/agent/tools/AgentContext";

export type RunAgentWorkflowInput = {
  messages: UIMessage[];
  chatId: string;
  sessionId: string;
  modelId: string;
  /**
   * JSON-serializable subset of AgentContext that survives the durable
   * workflow input. `runAgentStep` attaches the constructed `model`
   * before threading into `streamText`'s `experimental_context`.
   */
  agentContext: DurableAgentContext;
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

  const { workflowRunId } = getWorkflowMetadata();

  console.log("[runAgentWorkflow] start", {
    chatId: input.chatId,
    sessionId: input.sessionId,
    modelId: input.modelId,
    workflowRunId,
  });

  const writable = getWritable<UIMessageChunk>();

  try {
    const result = await runAgentStep({
      messages: input.messages,
      modelId: input.modelId,
      writable,
      agentContext: input.agentContext,
    });
    console.log("[runAgentWorkflow] finish", { finishReason: result.finishReason });
  } finally {
    // Clear `chats.active_stream_id` (CAS-gated on this run's id) so the
    // client's "is this chat still streaming?" probe flips back to false
    // and the AI SDK can release `chat.status` from `submitted`. Runs
    // inside the workflow body (vs. an after() callback in the request
    // handler) so it fires immediately on the same workflow tick — no
    // polling lag. Mirrors open-agents' chat workflow.
    await clearChatActiveStream(input.chatId, workflowRunId);
  }
}
