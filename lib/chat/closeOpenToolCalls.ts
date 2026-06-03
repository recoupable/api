import type { UIMessage } from "ai";

/**
 * Walk a captured assistant message and transition any tool-call part still
 * in an "open" lifecycle state (input-streaming / input-available /
 * approval-requested / approval-responded) into `output-error` with
 * `errorText: "Cancelled"`.
 *
 * Used on the abort path of `runAgentStep` so that the assistant message
 * persisted to `chat_messages` reflects cancelled tools instead of leaving
 * tool-call parts open. Without this, reload renders those parts with a
 * spinner forever because the AI SDK has no terminal `tool-result` /
 * `tool-error` to transition them with.
 *
 * Returns the same `message` reference when no parts needed closing, so
 * callers can cheaply detect "nothing changed" and skip re-persistence.
 */
const OPEN_STATES: ReadonlySet<string> = new Set([
  "input-streaming",
  "input-available",
  "approval-requested",
  "approval-responded",
]);

export function closeOpenToolCalls(message: UIMessage): UIMessage {
  let mutated = false;
  const parts = message.parts.map(part => {
    const isToolPart = part.type === "dynamic-tool" || part.type.startsWith("tool-");
    if (!isToolPart) return part;
    const state = (part as { state?: string }).state;
    if (!state || !OPEN_STATES.has(state)) return part;
    mutated = true;
    return {
      ...part,
      state: "output-error",
      errorText: "Cancelled",
    } as typeof part;
  });
  if (!mutated) return message;
  return { ...message, parts };
}
