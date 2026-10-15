import { runs } from "@trigger.dev/sdk/v3";

/**
 * Retrieves a Trigger.dev task run by ID.
 *
 * @param runId - The unique identifier of the task run
 * @returns The raw task run from the SDK, or null if not found
 */
export async function retrieveTaskRun(runId: string) {
  try {
    return (await runs.retrieve(runId)) ?? null;
  } catch (error) {
    // Trigger's ApiError carries the provider HTTP status. Do not echo its body.
    if (error instanceof Error && "status" in error && error.status === 404) return null;
    throw error;
  }
}
