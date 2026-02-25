import { runs } from "@trigger.dev/sdk/v3";

export interface TaskRunListItem {
  id: string;
  status: string;
  taskIdentifier: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
  tags: string[];
}

/**
 * Lists recent task runs for an account by querying the Trigger.dev API
 * using the `account:<accountId>` tag.
 *
 * @param accountId - The account ID to filter runs by
 * @param limit - Maximum number of runs to return (default 20)
 * @returns Array of task run list items
 */
export async function listTaskRuns(
  accountId: string,
  limit: number = 20,
): Promise<TaskRunListItem[]> {
  const result = await runs.list({
    tag: [`account:${accountId}`],
    limit,
  });

  return result.data.map(run => ({
    id: run.id,
    status: run.status,
    taskIdentifier: run.taskIdentifier,
    createdAt: run.createdAt,
    startedAt: run.startedAt ?? null,
    finishedAt: run.finishedAt ?? null,
    durationMs: run.durationMs ?? null,
    tags: run.tags ?? [],
  }));
}
