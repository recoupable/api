import { runs } from "@trigger.dev/sdk/v3";
import type { TaskRun } from "./retrieveTaskRun";
import { toISOStringOrNull } from "./toISOStringOrNull";

/**
 * Lists recent task runs for an account by querying the Trigger.dev API
 * using the `account:<accountId>` tag. Returns the same TaskRun shape
 * as retrieveTaskRun (without output/error which are only on retrieve).
 *
 * @param accountId - The account ID to filter runs by
 * @param limit - Maximum number of runs to return (default 20)
 * @returns Array of TaskRun objects
 */
export async function listTaskRuns(
  accountId: string,
  limit: number = 20,
): Promise<TaskRun[]> {
  const tag = `account:${accountId}`;
  console.log("[listTaskRuns] querying runs", { tag, limit });

  const result = await runs.list({
    tag: [tag],
    limit,
  });

  console.log("[listTaskRuns] result", {
    count: result.data.length,
    runIds: result.data.map(r => r.id),
    statuses: result.data.map(r => r.status),
  });

  return result.data.map(run => ({
    id: run.id,
    status: run.status,
    taskIdentifier: run.taskIdentifier,
    createdAt: run.createdAt instanceof Date ? run.createdAt.toISOString() : String(run.createdAt),
    startedAt: toISOStringOrNull(run.startedAt),
    finishedAt: toISOStringOrNull(run.finishedAt),
    durationMs: run.durationMs,
    tags: run.tags,
    metadata: (run.metadata as Record<string, unknown>) ?? null,
  }));
}
