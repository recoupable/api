import { getWorkflowMetadata, getWritable } from "workflow";
import type { LanguageModelUsage, UIMessage, UIMessageChunk } from "ai";
import { closeChatStream } from "@/app/lib/workflows/closeChatStream";
import { generateAssistantMessageId } from "@/app/lib/workflows/generateAssistantMessageId";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";
import { clearChatActiveStream } from "@/lib/chat/clearChatActiveStream";
import { handleChatCredits } from "@/lib/credits/handleChatCredits";
import type { AgentMessageMetadata } from "@/lib/agent/messageMetadata/AgentMessageMetadata";
import type { DurableAgentContext } from "@/lib/agent/tools/AgentContext";

const ZERO_USAGE: LanguageModelUsage = {
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
} as LanguageModelUsage;

export type RunAgentWorkflowInput = {
  messages: UIMessage[];
  chatId: string;
  sessionId: string;
  /**
   * Authenticated account whose wallet absorbs the turn's cost. Resolved by
   * the route handler via `validateChatWorkflow` so we never trust a
   * caller-supplied id. Threaded into `recordChatUsage` after the assistant
   * message is persisted.
   */
  accountId: string;
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

  // Pick or generate a stable id for the assistant message. If the
  // last message in the conversation is already an assistant message
  // (we're resuming an in-progress turn after a tool-call interaction)
  // reuse its id so chunks append to the same `chat_messages` row.
  // Otherwise generate a fresh id once via a `"use step"` so the
  // value is durable across workflow replays. Mirrors open-agents'
  // pattern in `apps/web/app/workflows/chat.ts` where the id is
  // generated in the workflow body and threaded into every
  // `runAgentStep` call.
  const latestMessage = input.messages.at(-1);
  const assistantMessageId =
    latestMessage?.role === "assistant" ? latestMessage.id : await generateAssistantMessageId();

  try {
    const result = await runAgentStep({
      messages: input.messages,
      modelId: input.modelId,
      writable,
      chatId: input.chatId,
      agentContext: input.agentContext,
      assistantMessageId,
    });
    console.log("[runAgentWorkflow] finish", { finishReason: result.finishReason });

    // The assistant message is persisted per step inside `runAgentStep`, so
    // it's not written here. We still use the final `responseMessage` to
    // charge the account for this turn: atomic wallet debit + audit row via
    // the `deduct_credits_with_audit` Postgres function (`handleChatCredits`
    // → `recordCreditDeduction`). Fire-and-forget — transient credits-table
    // failures must not abort the chat workflow.
    if (result.responseMessage) {
      const metadata = result.responseMessage.metadata as AgentMessageMetadata | undefined;
      await handleChatCredits({
        accountId: input.accountId,
        model: input.modelId,
        source: "api",
        gatewayCostUsd: metadata?.totalMessageCost,
        usage: metadata?.totalMessageUsage ?? ZERO_USAGE,
      });
    }
  } finally {
    // Run two cleanup steps in parallel:
    //   1) `clearChatActiveStream` — CAS-gated DB clear of the chat's
    //      `active_stream_id` so the recovery probe flips to false.
    //   2) `closeChatStream` — explicitly close the workflow writable
    //      so the client's SSE response ends NOW. Without this, the
    //      writable stays open until Vercel Workflow's runtime
    //      garbage-collects the run (observed ~2m), and the AI SDK
    //      chat hook keeps `chat.status` in `submitted` waiting for
    //      stream-end. Mirrors open-agents'
    //      `Promise.all([clearActiveStream, sendFinish.then(closeStream)])`.
    //
    // `Promise.all` is safe because both helpers swallow their own
    // errors — a failure in one doesn't cancel the other.
    await Promise.all([
      clearChatActiveStream(input.chatId, workflowRunId),
      closeChatStream(writable),
    ]);
  }
}
