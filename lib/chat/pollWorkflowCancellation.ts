import { getRun } from "workflow/api";

// 150ms bounds how quickly the in-flight model call is aborted after the run
// is cancelled (matches open-agents' stop monitor). Lower = snappier Stop and
// fewer wasted tokens, at the cost of more `getRun().status` polls per turn.
export const DEFAULT_CANCELLATION_POLL_INTERVAL_MS = 150;

export type CancellationPoller = {
  stop: () => void;
  done: Promise<void>;
};

/** Aborts `controller` when `getRun(workflowRunId).status` flips to "cancelled". */
export function pollWorkflowCancellation(
  workflowRunId: string,
  controller: AbortController,
  intervalMs: number = DEFAULT_CANCELLATION_POLL_INTERVAL_MS,
): CancellationPoller {
  let stopped = false;
  const done = (async () => {
    while (!stopped && !controller.signal.aborted) {
      try {
        if ((await getRun(workflowRunId).status) === "cancelled") {
          controller.abort();
          return;
        }
      } catch {
        // Transient errors — keep polling.
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
