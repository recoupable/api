import type { UIMessageChunk } from "ai";

export type OpenTool = {
  toolName: string;
  sawInputAvailable: boolean;
};

/**
 * Updates the `open` tool-call map as UIMessage chunks stream by:
 *   - `tool-input-start` / `tool-input-available` → record the tool (the latter
 *     also marks the input phase complete so synthesis won't re-emit it),
 *   - any terminal `tool-output-*` / `tool-input-error` → remove it.
 *
 * The workflow stream watcher uses the resulting map to know which tool-calls
 * are still open when a run terminates, so it can synthesize closing chunks.
 *
 * @param chunk - The streamed UIMessage chunk.
 * @param open - Mutable map of in-flight tool-calls keyed by `toolCallId`.
 */
export function trackToolCallChunk(chunk: UIMessageChunk, open: Map<string, OpenTool>): void {
  switch (chunk.type) {
    case "tool-input-start":
      open.set(chunk.toolCallId, { toolName: chunk.toolName, sawInputAvailable: false });
      return;
    case "tool-input-available":
      // Both records the open tool (if we skipped tool-input-start) and
      // marks the input phase as complete so synthesis won't re-emit it.
      open.set(chunk.toolCallId, { toolName: chunk.toolName, sawInputAvailable: true });
      return;
    case "tool-output-available":
    case "tool-output-error":
    case "tool-output-denied":
    case "tool-input-error":
      open.delete(chunk.toolCallId);
      return;
    default:
      return;
  }
}
