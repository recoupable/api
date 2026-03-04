import { runs } from "@trigger.dev/sdk/v3";

/**
 * Polls a Trigger.dev task run until it completes.
 *
 * @param runId - The unique identifier of the task run
 * @returns The completed task run
 */
export async function pollTaskRun(runId: string) {
  return runs.poll(runId, {
    pollIntervalMs: 2000,
  });
}
