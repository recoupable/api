import { getWorkflowMetadata, getWritable } from "workflow";
import type { LanguageModelUsage, UIMessage, UIMessageChunk } from "ai";
import { closeChatStream } from "@/app/lib/workflows/closeChatStream";
import { generateAssistantMessageId } from "@/app/lib/workflows/generateAssistantMessageId";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";
import { clearChatActiveStream } from "@/lib/chat/clearChatActiveStream";
import { deleteEphemeralKeyStep } from "@/app/lib/workflows/deleteEphemeralKeyStep";
import { handleChatCredits } from "@/lib/credits/handleChatCredits";
import { autoCommitChatTurn } from "@/lib/chat/auto-commit/autoCommitChatTurn";
import type { AgentMessageMetadata } from "@/lib/agent/messageMetadata/AgentMessageMetadata";
import type { DurableAgentContext } from "@/lib/agent/tools/AgentContext";

const ZERO_USAGE: LanguageModelUsage = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  inputTokenDetails: { noCacheTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  outputTokenDetails: { textTokens: 0, reasoningTokens: 0 },
};

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
   * Optional chat title — used as context for the auto-commit
   * message-generation LLM call.
   */
  sessionTitle?: string;
  /**
   * Repo identifiers from `sessions.repo_owner` / `sessions.repo_name`.
   * When BOTH are present and the sandbox is reachable, the workflow
   * runs auto-commit after a successful turn (git add → LLM-generated
   * commit message → git commit → git push). Either being absent
   * skips auto-commit silently.
   */
  repoOwner?: string;
  repoName?: string;
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
      ...input,
      writable,
      assistantMessageId,
    });
    console.log("[runAgentWorkflow] finish", { finishReason: result.finishReason });

    // The assistant message is persisted per step inside `runAgentStep`, so
    // it's not written here. We still use the final `responseMessage` to
    // charge the account for this turn: atomic wallet debit + audit row via
    // the `deduct_credits_with_audit` Postgres function (`handleChatCredits`
    // → `recordCreditDeduction`).
    //
    // Charge on user-stop too — the provider already billed us for the
    // tokens consumed, and the assistant message (including partial tool
    // runs) is persisted, so the user owes the charge regardless of how
    // the turn ended. `result.responseMessage.metadata` carries the
    // usage actually consumed up to the abort point.
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

    // Auto-commit + push only after a natural finish. Skip on user-stop —
    // don't push half-done work, and `autoCommitChatTurn` can run 30+
    // seconds, holding the writable open. DurableAgentContext carries
    // the raw VercelState; the auto-commit helpers operate on the
    // discriminated SandboxState union so they can fan out to other
    // sandbox backends in the future.
    if (result.responseMessage && !result.aborted) {
      const sandboxState = input.agentContext.sandbox?.state
        ? ({ type: "vercel", ...input.agentContext.sandbox.state } as const)
        : undefined;
      await autoCommitChatTurn({
        ...input,
        ...result,
        writable,
        sandboxState,
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
    // A third cleanup step runs only for headless `/api/chat/runs` runs:
    //   3) `deleteEphemeralKeyStep` — revoke the per-run, account-scoped
    //      `recoup_sk_…` key minted for the sandbox the moment the run ends.
    //      The key's ~15m TTL is only the backstop if this delete is missed.
    //
    // `Promise.all` is safe because all helpers swallow their own errors —
    // a failure in one doesn't cancel the others.
    await Promise.all([
      clearChatActiveStream(input.chatId, workflowRunId),
      closeChatStream(writable),
      ...(input.agentContext.ephemeralKeyId
        ? [deleteEphemeralKeyStep(input.agentContext.ephemeralKeyId)]
        : []),
    ]);
  }
}
