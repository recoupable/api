import { runs } from "@trigger.dev/sdk/v3";

/**
 * Lists recent runs for a specific Trigger.dev schedule.
 * Uses the schedule ID as a tag filter since the SDK supports tag-based queries.
 *
 * @param scheduleId - The Trigger.dev schedule ID (e.g. sched_xxx)
 * @param limit - Maximum number of runs to return (default 5)
 * @returns Array of raw task runs from the SDK
 */
export async function listScheduleRuns(scheduleId: string, limit: number = 5) {
  const result = await runs.list({
    tag: [`schedule:${scheduleId}`],
    limit,
  });

  return result.data;
}
