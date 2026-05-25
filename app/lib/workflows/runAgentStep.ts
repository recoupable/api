import {
  streamText,
  convertToModelMessages,
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

export type RunAgentStepInput = {
  messages: UIMessage[];
  modelId: string;
  writable: WritableStream<UIMessageChunk>;
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
   * The assembled assistant message captured from
   * `toUIMessageStream`'s `onFinish` callback. `undefined` if the
   * stream finished without emitting one (e.g. an error path that
   * short-circuits before any chunks land). Used by `runAgentWorkflow`
   * to persist the final message to `chat_messages`.
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
 * @returns `finishReason` from the model run plus the assembled
 *   `responseMessage` (when one was emitted) so the caller can
 *   persist it.
 */
export async function runAgentStep(input: RunAgentStepInput): Promise<RunAgentStepResult> {
  "use step";

  console.log("[runAgentStep] start", {
    modelId: input.modelId,
    messageCount: input.messages.length,
    hasSandboxState: Boolean(input.agentContext.sandbox?.state),
  });

  const modelMessages = await convertToModelMessages(input.messages);
  // Mark the last tool with `cacheControl: { type: "ephemeral" }` so
  // Anthropic caches the tool-definitions block across the
  // conversation. Per-step message caching is wired via `prepareStep`
  // below. Mirrors open-agents' `prepareCall` + `prepareStep` split.
  const tools = addCacheControlToTools({
    tools: buildAgentTools({ skills: input.agentContext.skills }),
    model: input.modelId,
  });
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
    experimental_context: agentContext,
    // Mark the LAST message with cacheControl on every step so Anthropic
    // incrementally caches the conversation prefix. Mirrors open-agents'
    // `prepareStep` in `open-harness-agent.ts:100`.
    prepareStep: ({ messages, model }) => ({
      messages: addCacheControlToMessages({ messages, model }),
    }),
  });

  // Capture the assembled assistant message via `onFinish` so the
  // caller can persist it. Mirrors open-agents' `runAgentStep` which
  // stashes `finishedResponseMessage` into a closure-scoped variable
  // for the outer workflow body to forward into `persistAssistantMessage`.
  let responseMessage: UIMessage | undefined;

  // Acquire the writer once and release in `finally` so a thrown chunk
  // doesn't leak the lock.
  const writer = input.writable.getWriter();
  try {
    // `messageMetadata` emits {modelId, usage, cost} chunks the UI
    // renders as model/cost badges. Mirrors open-agents' chat workflow
    // shape so sandbox.recoupable.com sees the same metadata when cut
    // over to api's /api/chat/workflow.
    const messageMetadata = buildMessageMetadataCallback({ modelId: input.modelId });
    for await (const part of result.toUIMessageStream({
      messageMetadata,
      generateMessageId: () => input.assistantMessageId,
      onFinish: ({ responseMessage: finishedResponseMessage }) => {
        responseMessage = finishedResponseMessage;
      },
    })) {
      await writer.write(part);
    }
  } finally {
    writer.releaseLock();
  }

  const finishReason = await result.finishReason;
  console.log("[runAgentStep] finish", { finishReason, hasResponseMessage: !!responseMessage });
  return { finishReason, responseMessage };
}
