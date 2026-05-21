import type { LanguageModelUsage, TextStreamPart, ToolSet } from "ai";
import { addLanguageModelUsage } from "@/lib/agent/messageMetadata/addLanguageModelUsage";
import { extractGatewayCost } from "@/lib/agent/messageMetadata/extractGatewayCost";
import type {
  AgentMessageMetadata,
  AgentStepFinishMetadata,
} from "@/lib/agent/messageMetadata/AgentMessageMetadata";

/**
 * Build a stateful `messageMetadata` callback for `toUIMessageStream`.
 * Accumulates per-step usage + cost across an assistant turn and emits
 * the running totals on every `finish-step` part. Non-finish parts
 * return `undefined` (AI SDK skips emission).
 *
 * Mirrors open-agents' `apps/web/app/workflows/chat.ts` callback shape
 * so sandbox.recoupable.com's UI can render model/cost/usage badges
 * when cut over to api's `/api/chat/workflow`.
 *
 * Each call to `buildMessageMetadataCallback` returns a FRESH closure —
 * one per assistant turn — so totals reset between turns.
 */
export function buildMessageMetadataCallback(opts: { modelId: string }) {
  let lastStepUsage: LanguageModelUsage | undefined;
  let totalMessageUsage: LanguageModelUsage | undefined;
  let lastStepCost: number | undefined;
  let totalMessageCost: number | undefined;
  let stepFinishReasons: AgentStepFinishMetadata[] = [];

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
