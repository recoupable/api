import { runs } from "@trigger.dev/sdk/v3";

export type TaskRunResult =
  | { status: "pending" }
  | { status: "complete"; data: unknown }
  | { status: "failed"; error: string };

const PENDING_STATUSES = ["EXECUTING", "QUEUED", "REATTEMPTING", "PENDING", "WAITING_FOR_DEPLOY"];
const FAILED_STATUSES = [
  "FAILED",
  "CRASHED",
  "CANCELED",
  "SYSTEM_FAILURE",
  "INTERRUPTED",
  "EXPIRED",
  "TIMED_OUT",
];

/**
 * Retrieves the status of a Trigger.dev task run.
 *
 * @param runId - The unique identifier of the task run
 * @returns The task run result with status and data/error, or null if not found
 */
export async function retrieveTaskRun(runId: string): Promise<TaskRunResult | null> {
  const run = await runs.retrieve(runId);

  if (!run) {
    return null;
  }

  if (PENDING_STATUSES.includes(run.status)) {
    return { status: "pending" };
  }

  if (run.status === "COMPLETED") {
    return { status: "complete", data: run.output ?? null };
  }

  if (FAILED_STATUSES.includes(run.status)) {
    let errorMessage = "Task execution failed";

    if (run.status === "CANCELED") {
      errorMessage = "Task was canceled";
    } else if (run.error && typeof run.error === "object" && "message" in run.error) {
      errorMessage = (run.error as { message: string }).message;
    }

    return { status: "failed", error: errorMessage };
  }

  // Unknown status, treat as pending
  return { status: "pending" };
}
