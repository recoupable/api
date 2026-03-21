import { listScheduleRuns } from "@/lib/trigger/listScheduleRuns";
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
    const recentRuns = await listScheduleRuns(scheduleId, 5);

    const recent_runs: TaskRunInfo[] = recentRuns.map(run => ({
      id: run.id,
      status: run.status,
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
      durationMs: run.durationMs ?? null,
    }));

    let upcoming: string[] = [];

    // Get upcoming schedule times from the latest completed run's payload
    const latestCompleted = recentRuns.find(r => r.status === "COMPLETED");
    if (latestCompleted) {
      try {
        const fullRun = await retrieveTaskRun(latestCompleted.id);
        const payload = fullRun?.payload as { upcoming?: string[] } | undefined;
        if (payload?.upcoming && Array.isArray(payload.upcoming)) {
          upcoming = payload.upcoming;
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
