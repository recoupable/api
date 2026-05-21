import type { FinishReason, LanguageModelUsage } from "ai";
import type { AgentStepFinishMetadata } from "@/lib/agent/messageMetadata/AgentStepFinishMetadata";

/**
 * Metadata emitted on each assistant turn via the `messageMetadata`
 * callback in `runAgentStep`. Mirrors open-agents'
 * `apps/web/app/types.ts:WebAgentMessageMetadata` byte-for-byte so the
 * sandbox.recoupable.com UI can render model/cost/usage badges when
 * cut over to api's `/api/chat/workflow`. Now that api ships
 * `ai@^6.0.190`, `LanguageModelUsage` is the same flat-shape type
 * open-agents has been using — no shape conversion needed.
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
