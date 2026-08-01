import {
  streamText,
  createUIMessageStream,
  type ModelMessage,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { gateway } from "@ai-sdk/gateway";
import { agentCustomInstructions } from "@/lib/chat/agentCustomInstructions";
import { buildAgentSystemPrompt } from "@/lib/chat/buildAgentSystemPrompt";
import { buildAgentTools } from "@/lib/agent/buildAgentTools";
import type { AgentContext, DurableAgentContext } from "@/lib/agent/tools/AgentContext";
import { buildMessageMetadataCallback } from "@/lib/agent/messageMetadata/buildMessageMetadataCallback";
import type { AgentMessageMetadata } from "@/lib/agent/messageMetadata/AgentMessageMetadata";
import { addCacheControlToTools } from "@/lib/agent/contextManagement/addCacheControlToTools";
import { addCacheControlToMessages } from "@/lib/agent/contextManagement/addCacheControlToMessages";
import { wrapToolsWithAbort } from "@/lib/agent/contextManagement/wrapToolsWithAbort";
import { persistAssistantMessage } from "@/lib/chat/persistAssistantMessage";
import { pollWorkflowCancellation } from "@/lib/chat/pollWorkflowCancellation";
import { finalizeAbortedAssistantMessage } from "@/lib/chat/finalizeAbortedAssistantMessage";
import { getWorkflowMetadata } from "workflow";
import { pipeWorkflowStreamWithStopDetection } from "@/lib/chat/pipeWorkflowStreamWithStopDetection";

export type RunAgentStepInput = {
  /**
   * Conversation so far, in model form. Owned by `runAgentWorkflow`, which
   * appends each iteration's `responseMessages` before the next call — that
   * is how iteration N+1 sees iteration N's tool results.
   */
  modelMessages: ModelMessage[];
  /**
   * The UI-form messages this iteration appends to. When the last entry is
   * the in-progress assistant message, the AI SDK keeps building THAT
   * message rather than starting a new one, so `responseMessage` comes back
   * cumulative and each persist overwrites one row.
   */
  originalMessages: UIMessage[];
  modelId: string;
  writable: WritableStream<UIMessageChunk>;
  /** Target chat for persisting the assistant message as it streams. */
  chatId: string;
  /**
   * The JSON-serializable agent context that survives the durable
   * workflow input. `runAgentStep` widens it into a full `AgentContext`
   * by attaching `model` (and optionally `subagentModel`) before
   * threading into `streamText`'s `experimental_context`. Mirrors
   * open-agents' prepareCall pattern, where the constructed callModel
   * is added to `experimental_context` right before each model call.
   */
  agentContext: DurableAgentContext;
  /** Active artist for the run — surfaced in the agent's system prompt (chat#1837). */
  artistId?: string;
  /** Owning account id — surfaced alongside the artist in the system prompt. */
  accountId?: string;
  /**
   * Whether a user is present to answer `ask_user_question`. Interactive chat
   * sets true (default); headless runs (`/api/chat/runs`, `customer-prompt-task`)
   * set false so the tool is withheld — no one is there to reply.
   */
  interactive?: boolean;
  /**
   * Stable id to assign to the assistant message produced by this
   * step. Generated once in `runAgentWorkflow` so:
   *
   *   - Every chunk in this step's `toUIMessageStream` carries the
   *     same id (the AI SDK threads it through).
   *   - Future multi-step iterations of the agent loop reuse the
   *     same id so a single conversational reply is one row in
   *     `chat_messages` rather than fragmenting per tool-call cycle.
   *   - Resume after tool-call interaction reattaches to the in-
   *     progress assistant message rather than spawning a new one.
   *
   * Mirrors open-agents' `runAgentStep(messages, originalMessages,
   * messageId, ...)` signature in
   * `apps/web/app/workflows/chat.ts`.
   */
  assistantMessageId: string;
};

export type RunAgentStepResult = {
  finishReason: string;
  /**
   * The assembled assistant message captured from the stream's `onFinish`.
   * `undefined` if the stream finished without emitting one. Per-step
   * persistence happens inside this function; this is returned so
   * `runAgentWorkflow` can charge credits from `responseMessage.metadata`.
   */
  responseMessage: UIMessage | undefined;
  /**
   * Model-form messages this iteration produced (assistant turn + any tool
   * results). `runAgentWorkflow` appends these to `modelMessages` so the
   * next iteration continues the conversation instead of repeating it.
   */
  responseMessages: ModelMessage[];
  /** True when the user stopped the run; `runAgentWorkflow` skips billing + auto-commit on abort. */
  aborted: boolean;
};

/**
 * ONE LLM call (plus that call's tool executions) in the chat workflow.
 * Runs as a Vercel Workflow `"use step"` so:
 *
 *   - Sandbox-banned APIs (`fetch`, `setTimeout`, `crypto`) are legal inside.
 *   - The result is journaled — a replay resumes from the last completed
 *     iteration rather than re-billing the model and re-running tools.
 *
 * Deliberately does NOT set `stopWhen`: the AI SDK default is
 * `isStepCount(1)`, so this returns after a single model call and the
 * tool-call → tool-result → next-call loop is driven by `runAgentWorkflow`'s
 * body instead. That is the whole point of the decomposition — a step that
 * wrapped the full loop ran 11-25 minutes, blew Vercel's 800 s function
 * ceiling, and was retried 4 times, mailing the customer once per attempt
 * (chat#1918).
 *
 * @param input - Model messages + selected model + writable stream + agent context.
 * @returns finishReason, the cumulative assistant message, and this
 *          iteration's response messages for threading into the next.
 */
export async function runAgentStep(input: RunAgentStepInput): Promise<RunAgentStepResult> {
  "use step";

  console.log("[runAgentStep] start", {
    modelId: input.modelId,
    messageCount: input.modelMessages.length,
    hasSandboxState: Boolean(input.agentContext.sandbox?.state),
  });

  // Source an abort signal for streamText by polling our own run.status.
  const { workflowRunId } = getWorkflowMetadata();
  const cancelController = new AbortController();
  const poller = pollWorkflowCancellation(workflowRunId, cancelController);

  // Mark the last tool with `cacheControl: { type: "ephemeral" }` so
  // Anthropic caches the tool-definitions block across the conversation.
  // wrapToolsWithAbort backstops tools that ignore their own abortSignal —
  // without it, a hung tool keeps streamText awaiting forever on stop.
  const tools = wrapToolsWithAbort(
    addCacheControlToTools({
      tools: buildAgentTools({ skills: input.agentContext.skills, interactive: input.interactive }),
      model: input.modelId,
    }),
    cancelController.signal,
  );
  // Construct the model here (not in the workflow input) — LanguageModel
  // instances aren't JSON-serializable and can't ride durable inputs.
  // Then attach to AgentContext so tools see the same model the parent
  // is using, matching open-agents' `prepareCall` pattern.
  const callModel = gateway(input.modelId);
  const agentContext: AgentContext = {
    ...input.agentContext,
    model: callModel,
  };
  // Build the system prompt with the sandbox's real cwd baked in
  // (rather than a static `agentCustomInstructions` string). Without
  // this the agent has to `pwd` on every turn because its prompt
  // doesn't tell it where it is. Mirrors open-agents'
  // `buildSystemPrompt`.
  const systemPrompt = buildAgentSystemPrompt({
    cwd: input.agentContext.sandbox.workingDirectory,
    customInstructions: agentCustomInstructions,
    artistId: input.artistId,
    accountId: input.accountId,
  });
  // No `stopWhen` — the AI SDK default `isStepCount(1)` bounds this call to
  // ONE model call so the step stays seconds long. The loop lives in
  // `runAgentWorkflow`. Mark the LAST message with cacheControl so Anthropic
  // incrementally caches the conversation prefix; with one call per step
  // this replaces the old `prepareStep` hook.
  const result = streamText({
    model: callModel,
    system: systemPrompt,
    messages: addCacheControlToMessages({ messages: input.modelMessages, model: input.modelId }),
    tools,
    abortSignal: cancelController.signal,
    experimental_context: agentContext,
  });

  // `messageMetadata` emits {modelId, usage, cost} chunks the UI renders as
  // model/cost badges. Seeded from the in-progress assistant message so the
  // running totals span the whole turn rather than resetting each iteration.
  const previousMessage = input.originalMessages.at(-1);
  const previousMetadata =
    previousMessage?.role === "assistant"
      ? (previousMessage.metadata as AgentMessageMetadata | undefined)
      : undefined;
  const messageMetadata = buildMessageMetadataCallback({
    modelId: input.modelId,
    seed: previousMetadata,
  });

  // createUIMessageStream exposes onStepFinish/onFinish (toUIMessageStream
  // only has onFinish), so the assistant message is persisted after every
  // step — a stopped or crashed turn keeps the partial reply rather than
  // dropping it. The stable assistantMessageId makes each upsert overwrite
  // the same row. The final message is also captured so runAgentWorkflow can
  // charge credits from its metadata.
  let responseMessage: UIMessage | undefined;
  const uiStream = createUIMessageStream<UIMessage>({
    generateId: () => input.assistantMessageId,
    onStepFinish: ({ responseMessage: stepMessage }) => {
      responseMessage = stepMessage;
      return persistAssistantMessage(input.chatId, stepMessage);
    },
    onFinish: ({ responseMessage: finalMessage }) => {
      responseMessage = finalMessage;
      return persistAssistantMessage(input.chatId, finalMessage);
    },
    onError: error => {
      if (cancelController.signal.aborted) return "";
      return error instanceof Error ? error.message : String(error);
    },
    execute: ({ writer }) => {
      writer.merge(
        result.toUIMessageStream({
          messageMetadata,
          generateMessageId: () => input.assistantMessageId,
          // Continue building the in-progress assistant message rather than
          // starting a new one, so `responseMessage` stays cumulative across
          // iterations and each persist overwrites a single row.
          originalMessages: input.originalMessages,
          // The turn's `start`/`finish` chunks are emitted ONCE by the
          // workflow body (`sendStreamStart` / `sendStreamFinish`). Without
          // this the client would see one per iteration and render N
          // assistant messages instead of one.
          sendStart: false,
          sendFinish: false,
        }),
      );
    },
  });

  // Pipe the stream to the workflow writable and detect user-stop vs natural
  // finish (see pipeWorkflowStreamWithStopDetection for the why).
  const userAborted = await pipeWorkflowStreamWithStopDetection({
    uiStream,
    writable: input.writable,
    cancelController,
    workflowRunId,
    poller,
  });

  // Short-circuit on user-stop — `result.finishReason` rejects when streamText aborts.
  let finishReason: string;
  let responseMessages: ModelMessage[] = [];
  if (userAborted) {
    finishReason = "stop";
    // Prevent the late-rejecting promises from becoming unhandled rejections.
    void Promise.resolve(result.finishReason).catch(() => {});
    void Promise.resolve(result.response).catch(() => {});
  } else {
    // `result.response.messages` is the assistant message for this call plus
    // any tool-result message — exactly what the next iteration needs
    // appended. (`result.responseMessages` is ai@7; this repo is on 6.0.190.)
    const [reason, response] = await Promise.all([result.finishReason, result.response]);
    finishReason = reason;
    responseMessages = response.messages;
  }

  // On user-stop, close any tool-call parts the step boundary left open and
  // re-persist (see finalizeAbortedAssistantMessage for the why).
  if (userAborted && responseMessage) {
    responseMessage = await finalizeAbortedAssistantMessage(input.chatId, responseMessage);
  }

  console.log("[runAgentStep] finish", {
    finishReason,
    hasResponseMessage: !!responseMessage,
    responseMessageCount: responseMessages.length,
    aborted: userAborted,
  });
  return { finishReason, responseMessage, responseMessages, aborted: userAborted };
}
