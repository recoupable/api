import type { UIMessage } from "ai";

/** Counts tool UI parts without importing the Node-dependent SDK into durable workflow code. */
export function countToolCallsInMessage(message: UIMessage): number {
  return message.parts.filter(part => part.type === "dynamic-tool" || part.type.startsWith("tool-"))
    .length;
}
