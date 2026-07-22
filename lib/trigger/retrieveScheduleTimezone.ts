import { schedules } from "@trigger.dev/sdk";

/**
 * Reads the current timezone off a Trigger.dev schedule — the source of truth
 * for when a task fires (chat#1881 3c). Used to preserve the timezone on a
 * cron-only edit instead of resetting it to UTC, so we never store a separate
 * copy that can diverge.
 *
 * Best-effort: returns undefined if the schedule can't be read.
 *
 * @param scheduleId - The Trigger.dev schedule id
 * @returns The schedule's IANA timezone, or undefined
 */
export async function retrieveScheduleTimezone(scheduleId: string): Promise<string | undefined> {
  try {
    const schedule = await schedules.retrieve(scheduleId);
    return schedule?.timezone ?? undefined;
  } catch (error) {
    console.error("Error retrieving schedule timezone:", error);
    return undefined;
  }
}
