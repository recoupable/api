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
 *   2. On consumer cancel (client disconnect), releases the inner reader
 *      so the function invocation is not held open by an orphan reader.
 *      The underlying workflow run is intentionally NOT cancelled — runs
 *      are durable and a closed tab must be resumable via GET
 *      `/api/chat/{chatId}/stream`. The only place a workflow is
 *      explicitly cancelled is the POST `/stop` handler.
 *
 *   3. Treats `AbortError` / `ResponseAborted` / late workflow run-not-found
 *      (status-code-404) read failures as a clean close so reconnect races
 *      and platform-initiated aborts settle gracefully instead of bubbling
 *      a hard error to the SSE consumer.
 *
 * Shared by the POST start path (`handleChatWorkflowStream`) and the GET
 * resume path (`handleChatStreamResume`) so both inherit the same
 * cancellation, abort, and terminator semantics.
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
        // Aborts and late workflow-not-found surface as read rejections.
        // Treat them as clean shutdown — the consumer has already gone
        // away (or the workflow has — in which case the status watcher
        // will close us in the next tick). Surfacing them as errors
        // would crash the SSE consumer mid-stream.
        if (isAbortLikeError(err)) {
          closedByStatus = true;
          closeWithSyntheticErrors();
          return;
        }
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
      // Consumer (HTTP client / SSE) went away. Release the inner reader
      // so the workflow runtime can stop streaming into us; do NOT cancel
      // the underlying run — it is durable and the client is expected to
      // be able to reconnect via GET /api/chat/{chatId}/stream. Only
      // POST /api/chat/{chatId}/stop should ever cancel a run.
      consumerCancelled = true;
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

/**
 * Recognises the failure modes that should be treated as a clean shutdown
 * instead of a hard mid-stream error: client/platform AbortError, internal
 * ResponseAborted, and late workflow-not-found 404s that race with terminal
 * status detection.
 */
function isAbortLikeError(error: unknown): boolean {
  if (error === undefined) return true;
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError" || error.name === "ResponseAborted") return true;
  const message = error.message.toLowerCase();
  return message.includes("status code 404") && message.includes("not ok");
}
