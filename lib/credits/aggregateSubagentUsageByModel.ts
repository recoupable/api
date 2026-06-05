import type { LanguageModelUsage } from "ai";
import { sumLanguageModelUsage } from "@/lib/agent/messageMetadata/sumLanguageModelUsage";
import type { TaskToolUsageEvent } from "@/lib/credits/collectTaskToolUsageEvents";

export type SubagentUsageByModel = {
  modelId: string;
  usage: LanguageModelUsage;
  toolCallCount: number;
};

/**
 * Rolls up task-tool usage events into one entry per subagent model id.
 * Each task invocation counts as one tool call on the subagent row.
 */
export function aggregateSubagentUsageByModel(
  events: TaskToolUsageEvent[],
  fallbackModelId: string,
): SubagentUsageByModel[] {
  const byModel = new Map<string, SubagentUsageByModel>();

  for (const event of events) {
    const modelId = event.modelId ?? fallbackModelId;
    const existing = byModel.get(modelId);
    if (!existing) {
      byModel.set(modelId, {
        modelId,
        usage: event.usage,
        toolCallCount: 1,
      });
      continue;
    }

    const combinedUsage = sumLanguageModelUsage(existing.usage, event.usage);
    if (!combinedUsage) {
      continue;
    }

    byModel.set(modelId, {
      modelId,
      usage: combinedUsage,
      toolCallCount: existing.toolCallCount + 1,
    });
  }

  return [...byModel.values()];
}
