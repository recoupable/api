import { getWorkflowMetadata, getWritable } from "workflow";
import type { LanguageModelUsage, UIMessage, UIMessageChunk } from "ai";
import { closeChatStream } from "@/app/lib/workflows/closeChatStream";
import { generateAssistantMessageId } from "@/app/lib/workflows/generateAssistantMessageId";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";
import { convertMessagesStep } from "@/app/lib/workflows/convertMessagesStep";
import { sendStreamStart } from "@/app/lib/workflows/sendStreamStart";
import { sendStreamFinish } from "@/app/lib/workflows/sendStreamFinish";
import { persistAssistantMessageStep } from "@/app/lib/workflows/persistAssistantMessageStep";
import { CHAT_AGENT_MAX_ITERATIONS } from "@/lib/chat/const";
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
 * Runs the agent loop in THIS body, one `runAgentStep` per LLM call, up to
 * `CHAT_AGENT_MAX_ITERATIONS`. Each iteration is journaled, so a killed or
 * retried run resumes at the last completed call instead of re-executing the
 * whole turn from minute zero.
 *
 * This replaced a single step that wrapped the entire loop via
 * `stopWhen: stepCountIs(111)`. That step ran 11-25 minutes, exceeded
 * Vercel's 800 s function ceiling, and was killed and retried 4 times — five
 * complete agent runs, five emails to the customer, then a failed workflow.
 * See chat#1918.
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

  // Convert once, before the loop. The workflow body owns this array and
  // appends every iteration's `responseMessages` to it, which is how
  // iteration N+1 sees iteration N's tool results.
  const modelMessages = await convertMessagesStep(input.messages);

  // The assistant message under construction. Threaded into each iteration
  // as `originalMessages` so the AI SDK keeps appending to it instead of
  // starting a new message, and so the turn's running usage totals carry
  // across iterations.
  let pendingAssistantResponse: UIMessage =
    latestMessage?.role === "assistant"
      ? latestMessage
      : { id: assistantMessageId, role: "assistant", parts: [] };

  // One `start` chunk for the whole turn — each iteration's stream is told
  // `sendStart: false`, so without this the client renders N messages.
  await sendStreamStart(writable, assistantMessageId);

  // Tracks whether the terminal `finish` chunk has gone out, so the cleanup
  // below can emit it on a failure path without doubling it on the happy one.
  let streamFinished = false;

  try {
    let result: Awaited<ReturnType<typeof runAgentStep>> | undefined;

    // The agent loop lives HERE, in the workflow body, with one journaled
    // step per LLM call. It used to live inside `streamText` via
    // `stopWhen: stepCountIs(111)`, which made a single step run 11-25
    // minutes — past Vercel's 800 s function ceiling, so the platform killed
    // it and the queue retried it 4 times, each attempt a full agent run
    // that mailed the customer again (chat#1918).
    for (let iteration = 0; iteration < CHAT_AGENT_MAX_ITERATIONS; iteration++) {
      result = await runAgentStep({
        // Snapshot, not the live array — each iteration's input is a durable
        // step input and must describe the conversation as it was at THAT
        // call, unaffected by later appends.
        modelMessages: [...modelMessages],
        originalMessages: [pendingAssistantResponse],
        modelId: input.modelId,
        accountId: input.accountId,
        artistId: input.artistId,
        interactive: input.interactive,
        agentContext: input.agentContext,
        writable,
        assistantMessageId,
      });

      if (result.responseMessage) {
        pendingAssistantResponse = result.responseMessage;
        // Persist per iteration so a long turn's transcript stays live rather
        // than landing only at the end. The stable assistantMessageId makes
        // each write overwrite the same row.
        await persistAssistantMessageStep(input.chatId, pendingAssistantResponse);
      }
      modelMessages.push(...result.responseMessages);

      // A turn continues only while the model asked for more tools. Any
      // other finish reason — and any user stop — ends it.
      if (result.aborted || result.finishReason !== "tool-calls") break;
    }

    console.log("[runAgentWorkflow] finish", { finishReason: result?.finishReason });

    await sendStreamFinish(writable);
    streamFinished = true;

    // The assistant message is persisted per iteration inside `runAgentStep`,
    // so it's not written here. We still use the accumulated message to
    // charge the account for this turn: atomic wallet debit + audit row via
    // the `deduct_credits_with_audit` Postgres function (`handleChatCredits`
    // → `recordCreditDeduction`).
    //
    // `pendingAssistantResponse.metadata` carries the totals for the WHOLE
    // turn, not just the last iteration — `runAgentStep` seeds each
    // iteration's metadata callback from the message it was handed, so the
    // running totals survive the step boundaries.
    //
    // Charge on user-stop too — the provider already billed us for the
    // tokens consumed, and the assistant message (including partial tool
    // runs) is persisted, so the user owes the charge regardless of how
    // the turn ended.
    if (result?.responseMessage) {
      const metadata = pendingAssistantResponse.metadata as AgentMessageMetadata | undefined;
      await handleChatCredits({
        accountId: input.accountId,
        model: input.modelId,
        source: "api",
        resourceUrl: `/sessions/${input.sessionId}/chats/${input.chatId}`,
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
    if (result?.responseMessage && !result.aborted) {
      const sandboxState = input.agentContext.sandbox?.state
        ? ({ type: "vercel", ...input.agentContext.sandbox.state } as const)
        : undefined;
      await autoCommitChatTurn({
        ...input,
        ...result,
        responseMessage: pendingAssistantResponse,
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
    // `finish` must precede the close on EVERY exit path. A stream that ends
    // without it leaves the client in-flight forever — `useChat` waits for the
    // terminal chunk and `WorkflowChatTransport` loops `while (!gotFinish)` —
    // and once the run is terminal the resume route 204s, so the chunk is
    // unreachable after the fact. Guarded by `streamFinished` so a successful
    // turn does not emit two. Mirrors open-agents `chat.ts` L939 / L968-971:
    // `sendFinish(writable).then(() => closeStream(writable))`.
    await Promise.all([
      clearChatActiveStream(input.chatId, workflowRunId),
      (async () => {
        if (!streamFinished) await sendStreamFinish(writable);
        await closeChatStream(writable);
      })(),
      ...(input.agentContext.ephemeralKeyId
        ? [deleteEphemeralKeyStep(input.agentContext.ephemeralKeyId)]
        : []),
    ]);
  }
}
