import { isToolUIPart, type UIMessage } from "ai";

/**
 * Counts tool UI parts on an assistant message. Matches open-agents'
 * `recordUsage` inference so credit-spend digests reflect actual tool
 * volume on the main-agent `usage_events` row.
 */
export function countToolCallsInMessage(message: UIMessage): number {
  return message.parts.filter(isToolUIPart).length;
}
