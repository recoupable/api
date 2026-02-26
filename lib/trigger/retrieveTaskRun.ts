import { runs } from "@trigger.dev/sdk/v3";
import { toISOStringOrNull } from "./toISOStringOrNull";

export interface TaskRun {
  id: string;
  status: string;
  taskIdentifier: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number;
  tags: string[];
  metadata: Record<string, unknown> | null;
  output?: unknown;
  error?: { message: string; name?: string; stackTrace?: string } | null;
}

/**
 * Retrieves a Trigger.dev task run by ID.
 *
 * @param runId - The unique identifier of the task run
 * @returns The raw task run data, or null if not found
 */
export async function retrieveTaskRun(runId: string): Promise<TaskRun | null> {
  const run = await runs.retrieve(runId);

  if (!run) {
    return null;
  }

  return {
    id: run.id,
    status: run.status,
    taskIdentifier: run.taskIdentifier,
    createdAt: run.createdAt instanceof Date ? run.createdAt.toISOString() : String(run.createdAt),
    startedAt: toISOStringOrNull(run.startedAt),
    finishedAt: toISOStringOrNull(run.finishedAt),
    durationMs: run.durationMs,
    tags: run.tags,
    metadata: (run.metadata as Record<string, unknown>) ?? null,
    output: run.output ?? null,
    error: run.error ? (run.error as TaskRun["error"]) : null,
  };
}
