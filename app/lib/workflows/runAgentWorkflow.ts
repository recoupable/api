import { getWorkflowMetadata, getWritable } from "workflow";
import type { LanguageModelUsage, UIMessage, UIMessageChunk } from "ai";
import { closeChatStream } from "@/app/lib/workflows/closeChatStream";
import { generateAssistantMessageId } from "@/app/lib/workflows/generateAssistantMessageId";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";
import { clearChatActiveStream } from "@/lib/chat/clearChatActiveStream";
import { persistAssistantMessage } from "@/lib/chat/persistAssistantMessage";
import { handleChatCredits } from "@/lib/credits/handleChatCredits";
import { hasAutoCommitChanges } from "@/lib/chat/auto-commit/hasAutoCommitChanges";
import { runAutoCommit } from "@/lib/chat/auto-commit/runAutoCommit";
import { buildCommitData } from "@/lib/chat/auto-commit/buildCommitData";
import { sendCommitChunk } from "@/lib/chat/auto-commit/sendCommitChunk";
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
      messages: input.messages,
      modelId: input.modelId,
      writable,
      agentContext: input.agentContext,
      assistantMessageId,
    });
    console.log("[runAgentWorkflow] finish", { finishReason: result.finishReason });

    // Persist the final assistant message to `chat_messages` so a page
    // refresh after the stream completes still shows the reply. Without
    // this, the recoup-api cutover silently drops assistant responses —
    // they stream to the client over SSE but never land in the DB.
    // `persistAssistantMessage` is fire-and-forget by contract; it
    // swallows its own errors so a transient DB failure here doesn't
    // mark the workflow run failed.
    if (result.responseMessage) {
      await persistAssistantMessage(input.chatId, result.responseMessage);

      // Charge the account for this turn. Atomic wallet debit + audit
      // row insert via the `deduct_credits_with_audit` Postgres function
      // (wired into `handleChatCredits` → `recordCreditDeduction`).
      // Fire-and-forget by contract; transient credits-table failures
      // must not abort the chat workflow. Mirrors open-agents'
      // `recordWorkflowUsage` main-agent path
      // (apps/web/app/workflows/chat-post-finish.ts) and reuses the
      // same `handleChatCredits` orchestrator that `handleChatStream`
      // already uses for the non-workflow chat path.
      const metadata = result.responseMessage.metadata as AgentMessageMetadata | undefined;
      await handleChatCredits({
        accountId: input.accountId,
        model: input.modelId,
        source: "api",
        gatewayCostUsd: metadata?.totalMessageCost,
        usage: metadata?.totalMessageUsage ?? ZERO_USAGE,
      });

      // Auto-commit + push after a natural finish. Skipped silently
      // when the session lacks repo identifiers or the sandbox is
      // missing. The data-commit chunks (pending → resolved) are
      // emitted to the live SSE stream so the chat UI can render a
      // "Committing..." → "Committed at <sha>" affordance during the
      // turn. Mirrors open-agents'
      // `apps/web/app/workflows/chat.ts` canAutoCommit block.
      //
      // NOTE: the data-commit chunks are NOT re-persisted onto the
      // assistant message after this runs, so the UI affordance
      // disappears on page refresh. The commit itself is permanent
      // on GitHub. Re-persistence is tracked as a separate follow-up
      // (see recoupable/api#605).
      // DurableAgentContext carries the raw VercelState; the auto-commit
      // helpers operate on the discriminated SandboxState union so they
      // can fan out to other sandbox backends in the future. Wrap with
      // the `type: "vercel"` tag here.
      const sandboxState = input.agentContext.sandbox?.state
        ? ({ type: "vercel", ...input.agentContext.sandbox.state } as const)
        : undefined;
      const canAutoCommit =
        result.finishReason !== "tool-calls" &&
        input.repoOwner !== undefined &&
        input.repoName !== undefined &&
        sandboxState !== undefined;

      if (canAutoCommit) {
        const hasChanges = await hasAutoCommitChanges({ sandboxState });
        if (hasChanges) {
          const commitPartId = `${result.responseMessage.id}:commit`;
          // Emit the pending chunk BEFORE the commit step so the UI
          // can show a spinner while git add/commit/push run.
          await sendCommitChunk(writable, commitPartId, {
            status: "pending",
            committed: false,
            pushed: false,
          });
          const commitResult = await runAutoCommit({
            sessionId: input.sessionId,
            sessionTitle: input.sessionTitle ?? "",
            repoOwner: input.repoOwner!,
            repoName: input.repoName!,
            sandboxState,
          });
          await sendCommitChunk(
            writable,
            commitPartId,
            buildCommitData(commitResult, input.repoOwner!, input.repoName!),
          );
        }
      }
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
