import { assertMarkerFreeHistory } from "../continuation/assertMarkerFreeHistory";
import type { UIMessage } from "ai";
import { ProjectionEvidenceError } from "./ProjectionEvidenceError";
import type { ProjectionOriginal } from "./projectionSchemas";
/** Preserve canonical history and tool edits; restore only independently verified adjacent spans. */
export async function prepareProjectionHistory(
  messages: UIMessage[],
  verify?: (observation: unknown, message: UIMessage) => Promise<ProjectionOriginal>,
): Promise<{ canonical: UIMessage[]; native: UIMessage[] }> {
  assertMarkerFreeHistory(messages);
  const native: UIMessage[] = [];
  for (const message of messages) {
    const parts = [];
    let changed = false;
    const seen = new Set<string>();
    const content = (message as unknown as { content?: unknown }).content;
    const inputParts = message.parts ?? (Array.isArray(content) ? content : []);
    for (let index = 0; index < inputParts.length; index++) {
      const part = inputParts[index];
      if (
        ["custom", "reasoning-file", "tool-approval-request", "tool-approval-response"].includes(
          part.type,
        )
      )
        throw new ProjectionEvidenceError("invalid_observation");
      if (part.type !== "data-recoup-sdk-observation") {
        parts.push(part);
        continue;
      }
      if (message.role !== "assistant" || !verify)
        throw new ProjectionEvidenceError("producer_mismatch");
      const observation = part as { id?: string; data?: { fallback?: { partIndex?: number } } };
      if (
        !observation.id ||
        seen.has(observation.id) ||
        observation.data?.fallback?.partIndex !== index + 1
      )
        throw new ProjectionEvidenceError("span_mismatch");
      seen.add(observation.id);
      parts.push(await verify(part, message));
      index++; // Only the verified adjacent fallback is removed from native history.
      changed = true;
    }
    native.push(changed ? ({ ...message, parts } as UIMessage) : message);
  }
  return { canonical: messages, native };
}
