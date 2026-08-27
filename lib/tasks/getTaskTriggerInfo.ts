import { fetchTriggerRuns, type TriggerRun } from "@/lib/trigger/fetchTriggerRuns";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";
import { retrieveScheduleInfo } from "@/lib/trigger/retrieveScheduleInfo";

export interface TaskTriggerInfo {
  recent_runs: TriggerRun[];
  upcoming: string[];
  /** IANA timezone read from the Trigger.dev schedule (source of truth); null when unavailable. */
  timezone: string | null;
}

const EMPTY: TaskTriggerInfo = { recent_runs: [], upcoming: [], timezone: null };

/**
 * What Trigger.dev knows about one task's schedule: its last 5 runs, the
 * upcoming fire times, and the timezone. The schedule owns the timezone
 * (chat#1881 3c) and, for a task that has never run, the only known next
 * fire time (chat#2006 item 6); a run's payload carries the fuller list.
 * Best-effort: any Trigger.dev failure yields the empty shape.
 */
export async function getTaskTriggerInfo(scheduleId: string | null): Promise<TaskTriggerInfo> {
  if (!scheduleId) return EMPTY;
  try {
    const [recentRuns, schedule] = await Promise.all([
      fetchTriggerRuns({ "filter[schedule]": scheduleId }, 5),
      retrieveScheduleInfo(scheduleId),
    ]);
    let upcoming: string[] = schedule.nextRun ? [schedule.nextRun] : [];
    const latestRun = recentRuns[0];
    if (latestRun) {
      try {
        const fullRun = await retrieveTaskRun(latestRun.id);
        const payload = fullRun?.payload as { upcoming?: unknown[] } | undefined;
        if (Array.isArray(payload?.upcoming)) {
          upcoming = payload.upcoming.filter((item): item is string => typeof item === "string");
        }
      } catch {
        // payload retrieval failed — keep the schedule's next fire
      }
    }
    return { recent_runs: recentRuns, upcoming, timezone: schedule.timezone ?? null };
  } catch {
    return EMPTY;
  }
}
