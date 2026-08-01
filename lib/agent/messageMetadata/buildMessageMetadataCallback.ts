import type { LanguageModelUsage, TextStreamPart, ToolSet } from "ai";
import { addLanguageModelUsage } from "@/lib/agent/messageMetadata/addLanguageModelUsage";
import { extractGatewayCost } from "@/lib/agent/messageMetadata/extractGatewayCost";
import type { AgentMessageMetadata } from "@/lib/agent/messageMetadata/AgentMessageMetadata";
import type { AgentStepFinishMetadata } from "@/lib/agent/messageMetadata/AgentStepFinishMetadata";

/**
 * Build a stateful `messageMetadata` callback for `toUIMessageStream`.
 * Accumulates per-step usage + cost across an assistant turn and emits
 * the running totals on every `finish-step` part. Non-finish parts
 * return `undefined` (AI SDK skips emission).
 *
 * Mirrors open-agents' `apps/web/app/workflows/chat.ts` callback shape
 * so sandbox.recoupable.com's UI can render model/cost/usage badges
 * when cut over to api's `/api/chat/workflow`. api and open-agents now
 * share the same `ai@^6.0.190` shape for `LanguageModelUsage`, so no
 * shape conversion happens here.
 *
 * Each call to `buildMessageMetadataCallback` returns a FRESH closure —
 * one per assistant turn — so totals reset between turns.
 */
export function buildMessageMetadataCallback(opts: {
  modelId: string;
  /**
   * Running totals carried over from earlier iterations of the same turn.
   *
   * `runAgentWorkflow` now runs one `runAgentStep` per LLM call, and each
   * call builds a fresh closure — without a seed the badges would reset to
   * this iteration's numbers and under-report the turn. Pass the in-progress
   * assistant message's metadata to keep the totals cumulative.
   */
  seed?: Pick<AgentMessageMetadata, "totalMessageUsage" | "totalMessageCost" | "stepFinishReasons">;
}) {
  let lastStepUsage: LanguageModelUsage | undefined;
  let totalMessageUsage: LanguageModelUsage | undefined = opts.seed?.totalMessageUsage;
  let lastStepCost: number | undefined;
  let totalMessageCost: number | undefined = opts.seed?.totalMessageCost;
  let stepFinishReasons: AgentStepFinishMetadata[] = [...(opts.seed?.stepFinishReasons ?? [])];

  return function messageMetadata({
    part,
  }: {
    part: TextStreamPart<ToolSet>;
  }): AgentMessageMetadata | undefined {
    if (part.type !== "finish-step") return undefined;

    const finishPart = part as TextStreamPart<ToolSet> & {
      usage?: LanguageModelUsage;
      providerMetadata?: Parameters<typeof extractGatewayCost>[0];
      finishReason?: AgentStepFinishMetadata["finishReason"];
      rawFinishReason?: string;
    };

    if (finishPart.usage) {
      lastStepUsage = finishPart.usage;
      totalMessageUsage = totalMessageUsage
        ? addLanguageModelUsage(totalMessageUsage, finishPart.usage)
        : finishPart.usage;
    }

    const stepCost = extractGatewayCost(finishPart.providerMetadata);
    if (stepCost !== undefined) {
      lastStepCost = stepCost;
      totalMessageCost = (totalMessageCost ?? 0) + stepCost;
    }

    if (finishPart.finishReason) {
      stepFinishReasons = [
        ...stepFinishReasons,
        {
          finishReason: finishPart.finishReason,
          rawFinishReason: finishPart.rawFinishReason,
        },
      ];
    }

    return {
      // `selectedModelId` and `modelId` are equal in api today (no
      // gateway fallback routing exposed) — emit both for shape
      // parity with open-agents' WebAgentMessageMetadata.
      selectedModelId: opts.modelId,
      modelId: opts.modelId,
      lastStepUsage,
      totalMessageUsage,
      lastStepCost,
      totalMessageCost,
      lastStepFinishReason: finishPart.finishReason,
      lastStepRawFinishReason: finishPart.rawFinishReason,
      stepFinishReasons,
    };
  };
}
