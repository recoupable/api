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
  console.log("[diag][poll] start", { workflowRunId, intervalMs, ts: startedAt });
  const done = (async () => {
    while (!stopped && !controller.signal.aborted) {
      const pollStart = Date.now();
      let status: string | undefined;
      let err: string | undefined;
      try {
        status = await getRun(workflowRunId).status;
      } catch (e) {
        err = e instanceof Error ? e.message : String(e);
      }
      pollCount += 1;
      const elapsedMs = Date.now() - startedAt;
      const rttMs = Date.now() - pollStart;
      console.log("[diag][poll] tick", {
        workflowRunId,
        pollCount,
        elapsedMs,
        rttMs,
        status,
        err,
      });
      if (status === "cancelled") {
        console.log("[diag][poll] CANCEL DETECTED → controller.abort()", {
          workflowRunId,
          pollCount,
          elapsedMs,
        });
        controller.abort();
        return;
      }
      if (stopped || controller.signal.aborted) return;
      await new Promise<void>(resolve => setTimeout(resolve, intervalMs));
    }
    console.log("[diag][poll] exit", {
      workflowRunId,
      pollCount,
      elapsedMs: Date.now() - startedAt,
      stopped,
      aborted: controller.signal.aborted,
    });
  })();
  return {
    stop: () => {
      stopped = true;
    },
    done,
  };
}
