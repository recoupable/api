import type { UIMessage } from "ai";
import { aggregateSubagentUsageByModel } from "@/lib/credits/aggregateSubagentUsageByModel";
import { collectTaskToolUsageEvents } from "@/lib/credits/collectTaskToolUsageEvents";
import { filterNewTaskUsageEvents } from "@/lib/credits/filterNewTaskUsageEvents";
import { handleChatCredits } from "@/lib/credits/handleChatCredits";

interface HandleSubagentChatCreditsParams {
  accountId: string;
  responseMessage: UIMessage;
  previousResponseMessage?: UIMessage;
  fallbackModelId: string;
  source?: "web" | "api";
}

/**
 * Records one `usage_events` row per subagent model for new `task` tool
 * completions on this turn. Mirrors open-agents `recordUsage` subagent
 * loop in `chat-post-finish.ts`.
 */
export async function handleSubagentChatCredits({
  accountId,
  responseMessage,
  previousResponseMessage,
  fallbackModelId,
  source = "api",
}: HandleSubagentChatCreditsParams): Promise<void> {
  const baselineEvents = previousResponseMessage
    ? collectTaskToolUsageEvents(previousResponseMessage)
    : [];
  const deltaEvents = filterNewTaskUsageEvents(
    collectTaskToolUsageEvents(responseMessage),
    baselineEvents,
  );

  if (deltaEvents.length === 0) {
    return;
  }

  const byModel = aggregateSubagentUsageByModel(deltaEvents, fallbackModelId);

  for (const entry of byModel) {
    await handleChatCredits({
      accountId,
      model: entry.modelId,
      source,
      agentType: "subagent",
      usage: entry.usage,
      toolCallCount: entry.toolCallCount,
    });
  }
}
