import { runs } from "@trigger.dev/sdk/v3";

/**
 * Retrieves a Trigger.dev task run by ID.
 *
 * @param runId - The unique identifier of the task run
 * @returns The raw task run from the SDK, or null if not found
 */
export async function retrieveTaskRun(runId: string) {
  const run = await runs.retrieve(runId);

  if (!run) {
    return null;
  }

  return run;
}
