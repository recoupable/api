import { runs } from "@trigger.dev/sdk/v3";

interface TaskRunCommonFields {
  metadata: Record<string, unknown> | null;
  taskIdentifier: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
}

export type TaskRunResult =
  | (TaskRunCommonFields & { status: "pending" })
  | (TaskRunCommonFields & { status: "complete"; data: unknown })
  | (TaskRunCommonFields & { status: "failed"; error: string });

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

  const common: TaskRunCommonFields = {
    metadata: (run.metadata as Record<string, unknown>) ?? null,
    taskIdentifier: run.taskIdentifier,
    createdAt: run.createdAt instanceof Date ? run.createdAt.toISOString() : String(run.createdAt),
    startedAt: run.startedAt
      ? run.startedAt instanceof Date
        ? run.startedAt.toISOString()
        : String(run.startedAt)
      : null,
    finishedAt: run.finishedAt
      ? run.finishedAt instanceof Date
        ? run.finishedAt.toISOString()
        : String(run.finishedAt)
      : null,
    durationMs: run.durationMs ?? null,
  };

  if (PENDING_STATUSES.includes(run.status)) {
    return { ...common, status: "pending" };
  }

  if (run.status === "COMPLETED") {
    return { ...common, status: "complete", data: run.output ?? null };
  }

  if (FAILED_STATUSES.includes(run.status)) {
    let errorMessage = "Task execution failed";

    if (run.status === "CANCELED") {
      errorMessage = "Task was canceled";
    } else if (run.error && typeof run.error === "object" && "message" in run.error) {
      errorMessage = (run.error as { message: string }).message;
    }

    return { ...common, status: "failed", error: errorMessage };
  }

  // Unknown status, treat as pending
  return { ...common, status: "pending" };
}
