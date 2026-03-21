import { fetchTriggerRuns } from "@/lib/trigger/fetchTriggerRuns";

/**
 * Lists recent runs for a specific Trigger.dev schedule.
 *
 * @param scheduleId - The Trigger.dev schedule ID (e.g. sched_xxx)
 * @param limit - Maximum number of runs to return (default 5)
 * @returns Array of run objects
 */
export async function listScheduleRuns(scheduleId: string, limit: number = 5) {
  return fetchTriggerRuns({ "filter[schedule]": scheduleId }, limit);
}
