import { updateScheduledAction } from "@/lib/supabase/scheduled_actions/updateScheduledAction";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { syncTriggerSchedule } from "@/lib/trigger/syncTriggerSchedule";
import {
  updateTaskPersistInputSchema,
  type UpdateTaskPersistInput,
} from "@/lib/tasks/updateTaskSchemas";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import type { Tables, TablesUpdate } from "@/types/database.types";

/** Thrown when the row exists but `resolvedAccountId` cannot access `scheduled_actions.account_id`. */
export const TASK_ACCESS_DENIED_MESSAGE = "Access denied to this task";

/**
 * Updates an existing task (scheduled action) when the caller can access the
 * account that owns it: their own, one sharing an organization, or any for a
 * Recoup admin (`canAccessAccount`). Body `account_id` is accepted for
 * compatibility but no longer needed to reach another account's task.
 *
 * @param input - Validated PATCH body minus body `account_id`, plus resolved `resolvedAccountId`
 * @returns The updated task
 */
export async function updateTask(
  input: UpdateTaskPersistInput,
): Promise<Tables<"scheduled_actions">> {
  const validatedInput = updateTaskPersistInputSchema.parse(input);
  const { id, schedule, enabled, timezone, resolvedAccountId } = validatedInput;

  const existingTasks = await selectScheduledActions({ id });
  const existingTask = existingTasks[0];

  if (!existingTask) {
    throw new Error("Task not found");
  }

  const allowed = await canAccessAccount({
    currentAccountId: resolvedAccountId,
    targetAccountId: existingTask.account_id,
  });
  if (!allowed) {
    throw new Error(TASK_ACCESS_DENIED_MESSAGE);
  }

  const updateData = Object.fromEntries(
    Object.entries(validatedInput).filter(([key, value]) => {
      if (value === undefined) return false;
      // `timezone` lives on the Trigger.dev schedule, not scheduled_actions.
      if (key === "id" || key === "resolvedAccountId" || key === "timezone") return false;
      return true;
    }),
  ) as Partial<TablesUpdate<"scheduled_actions">>;

  const finalEnabled = enabled !== undefined ? enabled : (existingTask.enabled ?? true);
  const cronExpression = schedule ?? existingTask.schedule;
  // A timezone-only change still needs the schedule re-synced (the cron falls
  // back to the existing expression), so treat it as a schedule change.
  const scheduleChanged = schedule !== undefined || timezone !== undefined;

  const newTriggerScheduleId = await syncTriggerSchedule({
    taskId: id,
    enabled: finalEnabled ?? existingTask.enabled ?? true,
    cronExpression,
    scheduleChanged,
    existingScheduleId: existingTask.trigger_schedule_id ?? null,
    timezone,
  });

  if (newTriggerScheduleId !== existingTask.trigger_schedule_id) {
    updateData.trigger_schedule_id = newTriggerScheduleId;
  }

  // A timezone-only change touches the Trigger.dev schedule but no
  // scheduled_actions column, leaving `updateData` empty — skip the DB write
  // (an empty update errors) and return the unchanged row (chat#1881 3c).
  if (Object.keys(updateData).length === 0) {
    return existingTask;
  }

  const updated = await updateScheduledAction({
    id,
    ...updateData,
  });

  return updated;
}
