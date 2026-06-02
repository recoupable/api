import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { gateway } from "@ai-sdk/gateway";
import { agentCustomInstructions } from "@/lib/chat/agentCustomInstructions";
import { buildAgentSystemPrompt } from "@/lib/chat/buildAgentSystemPrompt";
import { CHAT_AGENT_STOP_WHEN } from "@/lib/chat/const";
import { buildAgentTools } from "@/lib/agent/buildAgentTools";
import type { AgentContext, DurableAgentContext } from "@/lib/agent/tools/AgentContext";
import { buildMessageMetadataCallback } from "@/lib/agent/messageMetadata/buildMessageMetadataCallback";
import { addCacheControlToTools } from "@/lib/agent/contextManagement/addCacheControlToTools";
import { addCacheControlToMessages } from "@/lib/agent/contextManagement/addCacheControlToMessages";
import { wrapToolsWithAbort } from "@/lib/agent/contextManagement/wrapToolsWithAbort";
import { persistAssistantMessage } from "@/lib/chat/persistAssistantMessage";
import { pollWorkflowCancellation } from "@/lib/chat/pollWorkflowCancellation";
import { getWorkflowMetadata } from "workflow";

export type RunAgentStepInput = {
  messages: UIMessage[];
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
};

/**
 * One LLM turn (with internal tool-call iteration) in the chat workflow.
 * Runs as a Vercel Workflow `"use step"` so:
 *
 *   - Sandbox-banned APIs (`fetch`, `setTimeout`, `crypto`) are legal inside.
 *   - The result is cached as a single durable event — replays after a crash
 *     do not re-bill the model or re-execute tools.
 *
 * `streamText` drives the tool-call → tool-result → next-LLM-call loop
 * internally using its default stop condition. Our outer workflow stays
 * single-turn for now — multi-turn message threading lands when the rest
 * of the tool surface ports in a follow-up PR.
 *
 * @param input - Messages + selected model + writable stream + agent context.
 * @returns finishReason plus the assembled assistant message.
 */
export async function runAgentStep(input: RunAgentStepInput): Promise<RunAgentStepResult> {
  "use step";

  console.log("[runAgentStep] start", {
    modelId: input.modelId,
    messageCount: input.messages.length,
    hasSandboxState: Boolean(input.agentContext.sandbox?.state),
  });

  // @workflow/core@4.2.4 doesn't expose a step-scoped AbortSignal. Source one
  // ourselves by polling our own run's status: when POST /api/chat/{chatId}/stop
  // calls run.cancel() on us, status flips to "cancelled" and we abort the
  // local controller — which preempts streamText's LLM fetch + in-flight tools.
  const { workflowRunId } = getWorkflowMetadata();
  const cancelController = new AbortController();
  const poller = pollWorkflowCancellation(workflowRunId, cancelController);

  const modelMessages = await convertToModelMessages(input.messages);
  // Mark the last tool with `cacheControl: { type: "ephemeral" }` so
  // Anthropic caches the tool-definitions block across the
  // conversation. Per-step message caching is wired via `prepareStep`
  // below. Mirrors open-agents' `prepareCall` + `prepareStep` split.
  // wrapToolsWithAbort is the load-bearing piece for stop UX: even if a tool
  // ignores its own abortSignal (e.g. web_fetch wrapping a fetch without
  // signal), our wrapper races the tool's promise against cancelController so
  // streamText sees the rejection on stop, the agent loop unblocks, and the
  // workflow body returns — otherwise the SSE never closes and the chat UI
  // hangs in "streaming". The tool's underlying work may still finish in the
  // background; we just don't wait for it.
  const tools = wrapToolsWithAbort(
    addCacheControlToTools({
      tools: buildAgentTools({ skills: input.agentContext.skills }),
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
  });
  const result = streamText({
    model: callModel,
    system: systemPrompt,
    messages: modelMessages,
    tools,
    stopWhen: CHAT_AGENT_STOP_WHEN,
    // Plumbs the cancellation signal end-to-end: aborts the LLM fetch and is
    // re-exposed to tools via `execute(input, { abortSignal })`.
    abortSignal: cancelController.signal,
    experimental_context: agentContext,
    // Mark the LAST message with cacheControl on every step so Anthropic
    // incrementally caches the conversation prefix. Mirrors open-agents'
    // `prepareStep` in `open-harness-agent.ts:100`.
    prepareStep: ({ messages, model }) => ({
      messages: addCacheControlToMessages({ messages, model }),
    }),
  });

  // `messageMetadata` emits {modelId, usage, cost} chunks the UI renders as
  // model/cost badges.
  const messageMetadata = buildMessageMetadataCallback({ modelId: input.modelId });

  // createUIMessageStream exposes onStepFinish/onFinish (toUIMessageStream
  // only has onFinish), so the assistant message is persisted after every
  // step — a stopped or crashed turn keeps the partial reply rather than
  // dropping it. The stable assistantMessageId makes each upsert overwrite
  // the same row. The final message is also captured so runAgentWorkflow can
  // charge credits from its metadata.
  const stepStartedAt = Date.now();
  const sinceStart = () => Date.now() - stepStartedAt;
  console.log("[diag][step] start", { chatId: input.chatId, ts: stepStartedAt });

  let responseMessage: UIMessage | undefined;
  let stepCount = 0;
  const uiStream = createUIMessageStream<UIMessage>({
    generateId: () => input.assistantMessageId,
    onStepFinish: ({ responseMessage: stepMessage }) => {
      stepCount += 1;
      console.log("[diag][step] onStepFinish", {
        sinceStartMs: sinceStart(),
        stepCount,
        partsLen: stepMessage?.parts?.length ?? 0,
        aborted: cancelController.signal.aborted,
      });
      // Track the latest step's content so we can persist it on user-abort.
      responseMessage = stepMessage;
      return persistAssistantMessage(input.chatId, stepMessage);
    },
    onFinish: ({ responseMessage: finalMessage }) => {
      console.log("[diag][step] onFinish", {
        sinceStartMs: sinceStart(),
        stepCount,
        partsLen: finalMessage?.parts?.length ?? 0,
        aborted: cancelController.signal.aborted,
      });
      responseMessage = finalMessage;
      return persistAssistantMessage(input.chatId, finalMessage);
    },
    onError: error => {
      console.log("[diag][step] uiStream onError", {
        sinceStartMs: sinceStart(),
        aborted: cancelController.signal.aborted,
        message: error instanceof Error ? error.message : String(error),
      });
      // Expected on user-stop: swallow without surfacing a stream-level error.
      if (cancelController.signal.aborted) return "";
      // Bubble unexpected errors through the SDK's default formatter.
      return error instanceof Error ? error.message : String(error);
    },
    execute: ({ writer }) => {
      writer.merge(
        result.toUIMessageStream({
          messageMetadata,
          generateMessageId: () => input.assistantMessageId,
        }),
      );
    },
  });

  try {
    // preventClose/preventAbort: runAgentWorkflow's finally owns the writable's
    // lifecycle (closeChatStream), so don't close or abort it here.
    await uiStream.pipeTo(input.writable, { preventClose: true, preventAbort: true });
    console.log("[diag][step] pipeTo settled", { sinceStartMs: sinceStart() });
  } catch (err) {
    console.log("[diag][step] pipeTo threw", {
      sinceStartMs: sinceStart(),
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    // Whether the stream finished naturally or the user aborted, stop the
    // status poller so it doesn't keep hitting the workflow API.
    poller.stop();
    cancelController.abort();
    await poller.done.catch(() => {});
  }

  // `result.finishReason` rejects when streamText aborts; short-circuit on
  // user-stop so the step returns a clean { finishReason: "stop", responseMessage }
  // with whatever onStepFinish captured before the abort.
  let finishReason: string;
  if (cancelController.signal.aborted) {
    finishReason = "stop";
  } else {
    finishReason = await result.finishReason;
  }
  console.log("[diag][step] return", {
    sinceStartMs: sinceStart(),
    finishReason,
    hasResponseMessage: !!responseMessage,
    aborted: cancelController.signal.aborted,
  });
  return { finishReason, responseMessage };
}
