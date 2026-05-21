import type { FinishReason, LanguageModelUsage } from "ai";

/**
 * Per-finish-step record kept on the assistant message so the UI can
 * render a finish-reason history (open-agents shape).
 */
export type AgentStepFinishMetadata = {
  finishReason: FinishReason;
  rawFinishReason?: string;
};

/**
 * Metadata emitted on each assistant turn via the `messageMetadata`
 * callback in `runAgentStep`. Mirrors open-agents'
 * `apps/web/app/types.ts:WebAgentMessageMetadata` byte-for-byte so the
 * sandbox.recoupable.com UI can render model/cost/usage badges when
 * cut over to api's `/api/chat/workflow`.
 */
export type AgentMessageMetadata = {
  /** Model the client requested (e.g. user selection in the UI). */
  selectedModelId?: string;
  /** Model actually used for the call (may differ from selected under gateway fallback). */
  modelId?: string;
  /** Usage from the most recent `finish-step`. */
  lastStepUsage?: LanguageModelUsage;
  /** Cumulative usage across every step in this message. */
  totalMessageUsage?: LanguageModelUsage;
  /** Gateway-reported cost of the most recent step, in USD. */
  lastStepCost?: number;
  /** Cumulative gateway-reported cost across every step of the message, in USD. */
  totalMessageCost?: number;
  lastStepFinishReason?: FinishReason;
  lastStepRawFinishReason?: string;
  stepFinishReasons?: AgentStepFinishMetadata[];
};
