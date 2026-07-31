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
  /** Active artist for the run — surfaced in the agent's system prompt (chat#1837). */
  artistId?: string;
  /** Whether an interactive user is present (chat UI) to answer ask_user_question. */
  interactive?: boolean;
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

  // Charge the account for this turn: atomic wallet debit + audit row via the
  // `deduct_credits_with_audit` Postgres function (`handleChatCredits` →
  // `recordCreditDeduction`), using the usage on `responseMessage.metadata`
  // when present.
  //
  // This MUST run even when the step throws or returns no `responseMessage`.
  // A turn can run a customer-facing tool (e.g. `send_email`) mid-step, so if
  // billing were gated on a clean `responseMessage` return, a turn that emails
  // the customer and then fails would be free AND leave no `usage_events` row
  // (observed 2026-07-23: a scheduled briefing emailed the customer but wrote
  // zero LLM rows). `chargeTurn` is idempotent — the normal path bills exactly
  // once below; the `finally` backstop only fires when a throw skipped it.
  // ZERO_USAGE with no gateway cost floors to the 1c minimum in
  // `handleChatCredits`, so a failed turn still writes a `model_id` audit row.
  let result: Awaited<ReturnType<typeof runAgentStep>> | undefined;
  let charged = false;
  const chargeTurn = async () => {
    if (charged) return;
    charged = true;
    const metadata = result?.responseMessage?.metadata as AgentMessageMetadata | undefined;
    await handleChatCredits({
      accountId: input.accountId,
      model: input.modelId,
      source: "api",
      gatewayCostUsd: metadata?.totalMessageCost,
      usage: metadata?.totalMessageUsage ?? ZERO_USAGE,
    });
  };

  try {
    result = await runAgentStep({
      ...input,
      writable,
      assistantMessageId,
    });
    console.log("[runAgentWorkflow] finish", { finishReason: result.finishReason });

    // Charge on user-stop too — the provider already billed us for the tokens
    // consumed, and the assistant message (including partial tool runs) is
    // persisted, so the user owes the charge regardless of how the turn ended.
    await chargeTurn();

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
    // Billing backstop: if `runAgentStep` threw AFTER a customer-facing
    // side-effect already fired (e.g. the agent's `send_email` tool sent the
    // email, then the turn errored), the in-`try` charge above was skipped.
    // Bill here — `chargeTurn` is idempotent, so the success path is never
    // double-charged; a failed turn still lands a wallet debit + `usage_events`
    // audit row instead of emailing-but-not-billing. Runs before cleanup;
    // `handleChatCredits` swallows its own errors so it can't break the
    // cleanup steps below or mask the original throw.
    await chargeTurn();

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
