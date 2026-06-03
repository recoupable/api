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
import { closeOpenToolCalls } from "@/lib/chat/closeOpenToolCalls";
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
  /** True when the user stopped the run; `runAgentWorkflow` skips billing + auto-commit on abort. */
  aborted: boolean;
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

  // Source an abort signal for streamText by polling our own run.status.
  const { workflowRunId } = getWorkflowMetadata();
  const cancelController = new AbortController();
  const poller = pollWorkflowCancellation(workflowRunId, cancelController);

  const modelMessages = await convertToModelMessages(input.messages);
  // Mark the last tool with `cacheControl: { type: "ephemeral" }` so
  // Anthropic caches the tool-definitions block across the
  // conversation. Per-step message caching is wired via `prepareStep`
  // below. Mirrors open-agents' `prepareCall` + `prepareStep` split.
  // wrapToolsWithAbort backstops tools that ignore their own abortSignal —
  // without it, a hung tool keeps streamText awaiting forever on stop.
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
        }),
      );
    },
  });

  // Distinguish user-stop from natural completion: only the poller aborts the
  // controller before our own finally runs, so a pipeTo rejection with the
  // signal already aborted is the user-stop path. Captured here, not from
  // cancelController.signal.aborted after finally — the finally aborts the
  // controller unconditionally to stop the poller, which would otherwise
  // make every natural completion look like a user-stop.
  let userAborted = false;
  try {
    await uiStream.pipeTo(input.writable, {
      preventClose: true,
      preventAbort: true,
      signal: cancelController.signal,
    });
  } catch (err) {
    if (cancelController.signal.aborted) {
      userAborted = true;
    } else {
      throw err;
    }
  } finally {
    poller.stop();
    cancelController.abort();
    await poller.done.catch(() => {});
  }

  // Short-circuit on user-stop — `result.finishReason` rejects when streamText aborts.
  let finishReason: string;
  if (userAborted) {
    finishReason = "stop";
    // Prevent the late-rejecting promise from becoming an unhandled rejection.
    void Promise.resolve(result.finishReason).catch(() => {});
  } else {
    finishReason = await result.finishReason;
  }

  // On user-stop, close any tool-call parts that the step boundary persisted
  // without a terminal result and re-persist. Without this, reload renders
  // those parts as spinning forever — the AI SDK only transitions a tool
  // part when it sees a terminal `output-*` chunk for it.
  if (userAborted && responseMessage) {
    const closed = closeOpenToolCalls(responseMessage);
    if (closed !== responseMessage) {
      await persistAssistantMessage(input.chatId, closed);
      responseMessage = closed;
    }
  }

  console.log("[runAgentStep] finish", {
    finishReason,
    hasResponseMessage: !!responseMessage,
    aborted: userAborted,
  });
  return { finishReason, responseMessage, aborted: userAborted };
}
