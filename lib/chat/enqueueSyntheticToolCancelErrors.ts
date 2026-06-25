import type { UIMessageChunk } from "ai";
import type { OpenTool } from "@/lib/chat/trackToolCallChunk";

export const CANCEL_ERROR_TEXT = "Cancelled";

/**
 * Emits AI-SDK chunks that close any tool-calls still open when a workflow
 * stream ends without terminal tool-output chunks.
 */
export function enqueueSyntheticToolCancelErrors(
  controller: ReadableStreamDefaultController<UIMessageChunk>,
  openTools: Map<string, OpenTool>,
): void {
  for (const [toolCallId, tool] of openTools) {
    try {
      if (!tool.sawInputAvailable) {
        controller.enqueue({
          type: "tool-input-available",
          toolCallId,
          toolName: tool.toolName,
          input: {},
        } as UIMessageChunk);
      }
      controller.enqueue({
        type: "tool-output-error",
        toolCallId,
        errorText: CANCEL_ERROR_TEXT,
      } as UIMessageChunk);
    } catch {
      /* controller already closed */
    }
  }
  openTools.clear();
}
