import { getRun } from "workflow/api";

/**
 * Has this workflow run been cancelled?
 *
 * `run.cancel()` (our `POST /api/chat/[chatId]/stop` path) closes the run's
 * writable, so a step streaming into it can fail with a plain stream error
 * before its cancellation poller notices. `runAgentStep` asks this before
 * rethrowing, so a stop is reported as `aborted` rather than as a crash that
 * fails the whole workflow.
 *
 * A status read that itself fails is treated as "not cancelled" — better to
 * surface the original error than to swallow it on a transient blip.
 */
export async function isRunCancelled(workflowRunId: string): Promise<boolean> {
  try {
    return (await getRun(workflowRunId).status) === "cancelled";
  } catch {
    return false;
  }
}
