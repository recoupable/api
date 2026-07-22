import { createSchedule } from "./createSchedule";
import { updateSchedule } from "./updateSchedule";
import { deleteSchedule } from "./deleteSchedule";
import { retrieveScheduleTimezone } from "./retrieveScheduleTimezone";

type SyncTriggerScheduleParams = {
  taskId: string;
  enabled: boolean;
  cronExpression: string;
  scheduleChanged: boolean;
  existingScheduleId: string | null;
  /** IANA timezone the cron runs in (DST-aware). Undefined preserves the current one. */
  timezone?: string;
};

/**
 * Synchronises the Trigger.dev schedule for a task based on the desired enabled state
 * and cron expression. Returns the resulting Trigger.dev schedule id or null.
 *
 * The Trigger.dev schedule owns the timezone (chat#1881 3c): on create we pass it
 * through; on update we pass the new one if provided, otherwise read the existing
 * timezone back so a cron-only edit doesn't reset it to UTC.
 *
 * @param params - The parameters for synchronizing the schedule
 * @returns The Trigger.dev schedule ID or null
 */
export async function syncTriggerSchedule(
  params: SyncTriggerScheduleParams,
): Promise<string | null> {
  const { taskId, enabled, cronExpression, scheduleChanged, existingScheduleId, timezone } = params;
  const shouldDeleteSchedule = !enabled && existingScheduleId;
  const shouldUpdateSchedule = existingScheduleId && scheduleChanged;
  const shouldCreateSchedule = enabled && !existingScheduleId;

  if (shouldDeleteSchedule) {
    await deleteSchedule(existingScheduleId);
    return null;
  }

  if (shouldUpdateSchedule) {
    const resolvedTimezone = timezone ?? (await retrieveScheduleTimezone(existingScheduleId));
    await updateSchedule({
      scheduleId: existingScheduleId,
      cron: cronExpression,
      externalId: taskId,
      timezone: resolvedTimezone,
    });
    return existingScheduleId;
  }

  if (shouldCreateSchedule) {
    const createdSchedule = await createSchedule({
      cron: cronExpression,
      deduplicationKey: taskId,
      externalId: taskId,
      timezone,
    });
    return createdSchedule.id;
  }

  return existingScheduleId;
}
