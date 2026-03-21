import { fetchTriggerRuns, type TriggerRun } from "@/lib/trigger/fetchTriggerRuns";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";
import type { Tables } from "@/types/database.types";

type ScheduledAction = Tables<"scheduled_actions">;

interface EnrichedTask extends ScheduledAction {
  recent_runs: TriggerRun[];
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

    let upcoming: string[] = [];

    const latestRun = recentRuns[0];
    if (latestRun) {
      try {
        const fullRun = await retrieveTaskRun(latestRun.id);
        const payload = fullRun?.payload as { upcoming?: unknown[] } | undefined;
        if (Array.isArray(payload?.upcoming)) {
          upcoming = payload.upcoming.filter((item): item is string => typeof item === "string");
        }
      } catch {
        // payload retrieval failed — skip upcoming
      }
    }

    return { ...task, recent_runs: recentRuns, upcoming };
  } catch {
    // Trigger.dev API failed — return task without enrichment
    return { ...task, recent_runs: [], upcoming: [] };
  }
}
