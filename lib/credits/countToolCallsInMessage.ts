import { isToolUIPart, type UIMessage } from "ai";

/** Counts tool UI parts in the accumulated message, regardless of execution state. */
export function countToolCallsInMessage(message: UIMessage): number {
  return message.parts.filter(isToolUIPart).length;
}
