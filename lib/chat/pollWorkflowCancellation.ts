import { getRun } from "workflow/api";

/** Default cadence for cancellation polling — balances responsiveness vs. workflow-API call volume. */
export const DEFAULT_CANCELLATION_POLL_INTERVAL_MS = 750;

export type CancellationPoller = {
  /** Stops the polling loop. Safe to call multiple times. */
  stop: () => void;
  /** Resolves when the polling loop exits (either via `stop()` or after observing cancellation). */
  done: Promise<void>;
};

/**
 * Watches the workflow run's status while the agent step is in flight. When
 * `run.cancel()` flips the status to `"cancelled"` (the stop handler's effect),
 * we abort the controller so `streamText`'s `abortSignal` fires — that's what
 * actually preempts the LLM stream + in-flight tools.
 *
 * `@workflow/core@4.2.4` does not expose a step-scoped AbortSignal, so polling
 * `getRun().status` is the only way for a step to learn its own run was
 * cancelled. Polling errors (transient workflow-API hiccups) are swallowed —
 * we keep watching until the step finishes or the run is cancelled.
 *
 * @param workflowRunId - The current workflow run id (from `getWorkflowMetadata`).
 * @param controller - Aborted when `status === "cancelled"`.
 * @param intervalMs - Poll cadence in ms; defaults to {@link DEFAULT_CANCELLATION_POLL_INTERVAL_MS}.
 */
export function pollWorkflowCancellation(
  workflowRunId: string,
  controller: AbortController,
  intervalMs: number = DEFAULT_CANCELLATION_POLL_INTERVAL_MS,
): CancellationPoller {
  let stopped = false;
  let pollCount = 0;
  const startedAt = Date.now();
  console.log("[pollWorkflowCancellation] start", { workflowRunId, intervalMs });
  const done = (async () => {
    while (!stopped && !controller.signal.aborted) {
      try {
        const status = await getRun(workflowRunId).status;
        pollCount += 1;
        // Log every poll so we can see what status we're actually observing.
        console.log("[pollWorkflowCancellation] poll", {
          workflowRunId,
          pollCount,
          elapsedMs: Date.now() - startedAt,
          status,
        });
        if (status === "cancelled") {
          console.log("[pollWorkflowCancellation] CANCEL DETECTED — aborting", {
            workflowRunId,
            pollCount,
            elapsedMs: Date.now() - startedAt,
          });
          controller.abort();
          return;
        }
      } catch (err) {
        console.log("[pollWorkflowCancellation] poll error (swallowed)", {
          workflowRunId,
          message: err instanceof Error ? err.message : String(err),
        });
      }
      if (stopped || controller.signal.aborted) return;
      await new Promise<void>(resolve => setTimeout(resolve, intervalMs));
    }
    console.log("[pollWorkflowCancellation] exit", {
      workflowRunId,
      pollCount,
      stopped,
      aborted: controller.signal.aborted,
      elapsedMs: Date.now() - startedAt,
    });
  })();
  return {
    stop: () => {
      stopped = true;
    },
    done,
  };
}
