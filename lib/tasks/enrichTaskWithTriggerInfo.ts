import { fetchTriggerRuns } from "@/lib/trigger/fetchTriggerRuns";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";
import type { Tables } from "@/types/database.types";

type ScheduledAction = Tables<"scheduled_actions">;

interface TaskRunInfo {
  id: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
}

interface EnrichedTask extends ScheduledAction {
  recent_runs: TaskRunInfo[];
  upcoming: string[];
}

/**
 * Enriches a scheduled action with recent runs and upcoming schedule times
 * from the Trigger.dev API.
 *
 * @param task - The scheduled action from the database
 * @returns The task with recent_runs and upcoming fields added
 */
export async function enrichTaskWithTriggerInfo(task: ScheduledAction): Promise<EnrichedTask> {
  const scheduleId = task.trigger_schedule_id;

  if (!scheduleId) {
    return { ...task, recent_runs: [], upcoming: [] };
  }

  try {
    const recentRuns = await fetchTriggerRuns({ "filter[schedule]": scheduleId }, 5);

    const recent_runs: TaskRunInfo[] = recentRuns.map((run: Record<string, unknown>) => ({
      id: run.id as string,
      status: run.status as string,
      createdAt: run.createdAt as string,
      startedAt: (run.startedAt as string) ?? null,
      finishedAt: (run.finishedAt as string) ?? null,
      durationMs: (run.durationMs as number) ?? null,
    }));

    let upcoming: string[] = [];

    // Get upcoming from the most recent run (API returns desc order)
    const latestRun = recentRuns[0] as Record<string, unknown> | undefined;
    if (latestRun) {
      try {
        const fullRun = await retrieveTaskRun(latestRun.id as string);
        const payload = fullRun?.payload as { upcoming?: unknown[] } | undefined;
        if (Array.isArray(payload?.upcoming)) {
          upcoming = payload.upcoming.filter((item): item is string => typeof item === "string");
        }
      } catch {
        // payload retrieval failed — skip upcoming
      }
    }

    return { ...task, recent_runs, upcoming };
  } catch {
    // Trigger.dev API failed — return task without enrichment
    return { ...task, recent_runs: [], upcoming: [] };
  }
}
