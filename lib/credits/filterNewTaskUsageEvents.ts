/**
 * Returns task-tool usage events present on `currentEvents` but not on
 * `baselineEvents`. Used when resuming an in-progress assistant message
 * so subagent credits are not double-billed. Mirrors open-agents
 * `chat-post-finish.ts:filterNewTaskUsageEvents`.
 */
export function filterNewTaskUsageEvents<T extends { toolCallId?: string }>(
  currentEvents: T[],
  baselineEvents: T[],
): T[] {
  if (baselineEvents.length === 0) {
    return currentEvents;
  }

  const existingToolCallIds = new Set<string>();
  let existingEventsWithoutIds = 0;

  for (const event of baselineEvents) {
    const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId : undefined;
    if (toolCallId) {
      existingToolCallIds.add(toolCallId);
    } else {
      existingEventsWithoutIds += 1;
    }
  }

  let skippedWithoutIds = 0;
  const deltaEvents: T[] = [];

  for (const event of currentEvents) {
    const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId : undefined;

    if (toolCallId) {
      if (existingToolCallIds.has(toolCallId)) {
        continue;
      }
      deltaEvents.push(event);
      continue;
    }

    if (skippedWithoutIds < existingEventsWithoutIds) {
      skippedWithoutIds += 1;
      continue;
    }

    deltaEvents.push(event);
  }

  return deltaEvents;
}
