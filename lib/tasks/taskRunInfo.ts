/**
 * Subset of Trigger.dev run fields returned when enriching tasks.
 * Matches the TaskRunResponse schema in the API docs.
 */
export interface TaskRunInfo {
  id: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
}
