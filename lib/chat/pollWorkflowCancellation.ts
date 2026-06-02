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
  const done = (async () => {
    while (!stopped && !controller.signal.aborted) {
      try {
        const status = await getRun(workflowRunId).status;
        if (status === "cancelled") {
          controller.abort();
          return;
        }
      } catch {
        // Transient errors keep us polling — the user-initiated stop must
        // not be silently dropped because one read failed.
      }
      if (stopped || controller.signal.aborted) return;
      await new Promise<void>(resolve => setTimeout(resolve, intervalMs));
    }
  })();
  return {
    stop: () => {
      stopped = true;
    },
    done,
  };
}
