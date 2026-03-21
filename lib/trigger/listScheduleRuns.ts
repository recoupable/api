import { runs } from "@trigger.dev/sdk/v3";

/**
 * Lists recent runs for a specific Trigger.dev schedule.
 * Filters by account tag, then matches runs that belong to the schedule.
 *
 * @param scheduleId - The Trigger.dev schedule ID (e.g. sched_xxx)
 * @param accountTag - The account tag to filter by (e.g. account:uuid)
 * @param limit - Maximum number of runs to return (default 5)
 * @returns Array of raw task runs from the SDK
 */
export async function listScheduleRuns(scheduleId: string, accountTag: string, limit: number = 5) {
  const result = await runs.list({
    tag: [accountTag],
    limit: 50,
  });

  return result.data
    .filter(run => {
      const schedule = (run as Record<string, unknown>).schedule as { id?: string } | undefined;
      return schedule?.id === scheduleId;
    })
    .slice(0, limit);
}
