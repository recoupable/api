import type { UIMessageChunk } from "ai";
import { getRun } from "workflow/api";
import { trackToolCallChunk, type OpenTool } from "@/lib/chat/trackToolCallChunk";

/**
 * Watcher around a Vercel Workflow's UIMessage readable that:
 *
 *   1. Polls `getRun(runId).status`; when terminal, synthesizes
 *      `tool-output-error` chunks for any tool-calls that were started
 *      on the wire but never received a terminal `tool-output-*` chunk,
 *      then closes the consumer stream. Without this the AI SDK leaves
 *      those parts in their "executing" state on the live UI.
 *
 *   2. On consumer cancel (client disconnect / aiStop), propagates the
 *      cancel to the workflow run via `getRun(runId).cancel()`. Without
 *      this the run keeps producing chunks until the status poller
 *      detects cancellation independently — a ~750ms window where
 *      tools keep executing after the user has navigated away.
 *
 * Extracted from `handleChatWorkflowStream` so it can be unit-tested
 * in isolation.
 */
const TERMINAL_RUN_STATUSES: ReadonlySet<string> = new Set(["cancelled", "completed", "failed"]);
const STATUS_POLL_MS = 500;
const CANCEL_ERROR_TEXT = "Cancelled";

export function wrapWorkflowStreamWatcher(
  runId: string,
  source: ReadableStream<UIMessageChunk>,
): ReadableStream<UIMessageChunk> {
  let reader: ReadableStreamDefaultReader<UIMessageChunk> | null = null;
  let consumerCancelled = false;

  return new ReadableStream<UIMessageChunk>({
    async start(controller) {
      reader = source.getReader();
      const localReader = reader;
      const openTools = new Map<string, OpenTool>();
      let closedByStatus = false;

      const closeWithSyntheticErrors = () => {
        for (const [toolCallId, tool] of openTools) {
          try {
            // If we never saw `tool-input-available`, the AI SDK is still
            // in `input-streaming` state for this tool-call. Emitting
            // `tool-output-error` from that state is a no-op on most SDK
            // versions — the part stays spinning. Drive the state machine
            // forward by emitting `tool-input-available` (with `{}` as a
            // placeholder input) first so the SDK transitions to
            // `input-available`, then `tool-output-error` lands.
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
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const watcher = (async () => {
        while (!closedByStatus && !consumerCancelled) {
          try {
            const status = await getRun(runId).status;
            if (TERMINAL_RUN_STATUSES.has(status)) {
              closedByStatus = true;
              closeWithSyntheticErrors();
              try {
                await localReader.cancel();
              } catch {
                /* ignore */
              }
              return;
            }
          } catch {
            /* transient — keep watching */
          }
          await new Promise(r => setTimeout(r, STATUS_POLL_MS));
        }
      })();

      try {
        while (true) {
          const { done, value } = await localReader.read();
          if (closedByStatus || consumerCancelled) return;
          if (done) {
            // Source closed — could be natural finish OR runtime-cancel
            // closing the readable when status flipped terminal. Synthesize
            // tool-output-error for any still-open tool-call ids before
            // closing; on natural finish the set is empty (every tool
            // emitted its terminal chunk before the workflow body returned)
            // so this is a no-op.
            closedByStatus = true;
            closeWithSyntheticErrors();
            return;
          }
          trackToolCallChunk(value, openTools);
          controller.enqueue(value);
        }
      } catch (err) {
        if (closedByStatus || consumerCancelled) return;
        controller.error(err);
      } finally {
        closedByStatus = true;
        try {
          localReader.releaseLock();
        } catch {
          /* ignore */
        }
        await watcher.catch(() => {});
      }
    },
    async cancel() {
      consumerCancelled = true;
      try {
        await getRun(runId).cancel();
      } catch (error) {
        console.error("[wrapWorkflowStreamWatcher] cancel propagation failed:", error);
      }
      if (reader) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
      }
    },
  });
}
