import type { FinishReason } from "ai";

/**
 * Per-finish-step record kept on the assistant message so the UI can
 * render a finish-reason history. Mirrors open-agents'
 * `WebAgentStepFinishMetadata` in `apps/web/app/types.ts`.
 */
export type AgentStepFinishMetadata = {
  finishReason: FinishReason;
  rawFinishReason?: string;
};
