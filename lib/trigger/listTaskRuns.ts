import { runs } from "@trigger.dev/sdk/v3";
import type { TaskRunResult } from "./retrieveTaskRun";

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

function toISOStringOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Lists recent task runs for an account by querying the Trigger.dev API
 * using the `account:<accountId>` tag. Returns the same TaskRunResult shape
 * as retrieveTaskRun.
 *
 * @param accountId - The account ID to filter runs by
 * @param limit - Maximum number of runs to return (default 20)
 * @returns Array of TaskRunResult objects
 */
export async function listTaskRuns(
  accountId: string,
  limit: number = 20,
): Promise<TaskRunResult[]> {
  const result = await runs.list({
    tag: [`account:${accountId}`],
    limit,
  });

  return result.data.map(run => {
    const common = {
      id: run.id,
      metadata: (run.metadata as Record<string, unknown>) ?? null,
      taskIdentifier: run.taskIdentifier,
      createdAt: run.createdAt instanceof Date ? run.createdAt.toISOString() : String(run.createdAt),
      startedAt: toISOStringOrNull(run.startedAt),
      finishedAt: toISOStringOrNull(run.finishedAt),
      durationMs: run.durationMs ?? null,
    };

    if (run.status === "COMPLETED") {
      return { ...common, status: "complete" as const, data: run.output ?? null };
    }

    if (FAILED_STATUSES.includes(run.status)) {
      let errorMessage = "Task execution failed";
      if (run.status === "CANCELED") {
        errorMessage = "Task was canceled";
      }
      return { ...common, status: "failed" as const, error: errorMessage };
    }

    if (PENDING_STATUSES.includes(run.status)) {
      return { ...common, status: "pending" as const };
    }

    // Unknown status, treat as pending
    return { ...common, status: "pending" as const };
  });
}
