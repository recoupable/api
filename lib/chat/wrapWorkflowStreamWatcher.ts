import type { UIMessageChunk } from "ai";
import { getRun } from "workflow/api";
import { enqueueSyntheticToolCancelErrors } from "@/lib/chat/enqueueSyntheticToolCancelErrors";
import { trackToolCallChunk, type OpenTool } from "@/lib/chat/trackToolCallChunk";

/**
 * Watcher around a Vercel Workflow's UIMessage readable that:
 *
 *   1. Forwards chunks until the source is fully drained, then synthesizes
 *      `tool-output-error` chunks for any tool-calls left open on the wire.
 *
 *   2. On consumer cancel (client disconnect / aiStop), propagates cancel to
 *      the workflow run via `getRun(runId).cancel()`.
 */
const TERMINAL_RUN_STATUSES: ReadonlySet<string> = new Set(["cancelled", "completed", "failed"]);
const STATUS_POLL_MS = 500;

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

      const closeWithSyntheticErrors = () => {
        enqueueSyntheticToolCancelErrors(controller, openTools);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const watcher = (async () => {
        while (!consumerCancelled) {
          try {
            const status = await getRun(runId).status;
            if (TERMINAL_RUN_STATUSES.has(status)) {
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
          if (consumerCancelled) return;
          if (done) {
            closeWithSyntheticErrors();
            return;
          }
          trackToolCallChunk(value, openTools);
          controller.enqueue(value);
        }
      } catch (err) {
        if (consumerCancelled) return;
        controller.error(err);
      } finally {
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
