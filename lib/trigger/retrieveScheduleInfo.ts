import { schedules } from "@trigger.dev/sdk";

export interface ScheduleInfo {
  /** IANA timezone the cron is interpreted in. */
  timezone?: string;
  /** The schedule's next fire time, ISO 8601. */
  nextRun?: string;
}

/**
 * Reads what a task list needs off a Trigger.dev schedule in one call: the
 * timezone (source of truth, chat#1881 3c) and the next fire time, which
 * is the only place a never-run task's "next run" exists (chat#2006 item 6).
 *
 * Best-effort: an unreadable schedule yields an empty object, never a throw.
 *
 * @param scheduleId - The Trigger.dev schedule id
 * @returns The schedule's timezone and next fire time, when known
 */
export async function retrieveScheduleInfo(scheduleId: string): Promise<ScheduleInfo> {
  try {
    const schedule = await schedules.retrieve(scheduleId);
    return {
      timezone: schedule?.timezone ?? undefined,
      nextRun: schedule?.nextRun ? new Date(schedule.nextRun).toISOString() : undefined,
    };
  } catch (error) {
    console.error("Error retrieving schedule info:", error);
    return {};
  }
}
