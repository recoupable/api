interface DataPart {
  type: string;
  id: string;
  data: unknown;
}

interface AssistantMessage {
  id: string;
  role: string;
  parts: ReadonlyArray<unknown>;
}

/**
 * Returns a new assistant message with `part` merged into `parts`:
 *   - replaces the existing part when one with the same `{type, id}`
 *     is already present (e.g. pending → success transition for the
 *     same `data-commit` part)
 *   - appends otherwise
 *
 * Pure helper — the input message is not mutated. Mirrors
 * open-agents' `upsertAssistantDataPart` in
 * `apps/web/app/workflows/chat.ts`.
 *
 * Used by the auto-commit branch in `runAgentWorkflow` to persist the
 * resolved data-commit chunk onto the assistant message so the
 * `GitDataPartCard` UI renders on page refresh (not just during the
 * live SSE stream).
 */
export function upsertAssistantDataPart<TMessage extends AssistantMessage>(
  message: TMessage,
  part: DataPart,
): TMessage {
  const nextParts = [...message.parts];
  const existingIndex = nextParts.findIndex(p => {
    const candidate = p as { type?: string; id?: string };
    return candidate.type === part.type && candidate.id === part.id;
  });
  if (existingIndex >= 0) {
    nextParts[existingIndex] = part;
  } else {
    nextParts.push(part);
  }
  return { ...message, parts: nextParts };
}
