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
 * Best-effort: an unreadable or hung schedule yields an empty object, never a throw.
 *
 * @param scheduleId - The Trigger.dev schedule id
 * @returns The schedule's timezone and next fire time, when known
 */
const SCHEDULE_TIMEOUT_MS = 5000;

export async function retrieveScheduleInfo(scheduleId: string): Promise<ScheduleInfo> {
  try {
    // The SDK call has no abort option; a hung Trigger.dev must not block
    // /api/tasks, so race it against a timeout and treat that as unknown.
    const schedule = await Promise.race([
      schedules.retrieve(scheduleId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("schedule retrieve timed out")), SCHEDULE_TIMEOUT_MS),
      ),
    ]);
    return {
      timezone: schedule?.timezone ?? undefined,
      nextRun: schedule?.nextRun ? new Date(schedule.nextRun).toISOString() : undefined,
    };
  } catch (error) {
    console.error("Error retrieving schedule info:", error);
    return {};
  }
}
