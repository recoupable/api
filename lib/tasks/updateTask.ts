import { updateScheduledAction } from "@/lib/supabase/scheduled_actions/updateScheduledAction";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { syncTriggerSchedule } from "@/lib/trigger/syncTriggerSchedule";
import {
  updateTaskPersistInputSchema,
  type UpdateTaskPersistInput,
} from "@/lib/tasks/updateTaskSchemas";
import type { Tables, TablesUpdate } from "@/types/database.types";

/** Thrown row exists but `{ resolvedAccountId }` does not match `scheduled_actions.account_id`. */
export const TASK_ACCESS_DENIED_MESSAGE = "Access denied to this task";

/**
 * Updates an existing task (scheduled action) when the authenticated account owns the row.
 *
 * @param input - Validated PATCH body minus body `account_id`, plus resolved `resolvedAccountId`
 * @returns The updated task
 */
export async function updateTask(
  input: UpdateTaskPersistInput,
): Promise<Tables<"scheduled_actions">> {
  const validatedInput = updateTaskPersistInputSchema.parse(input);
  const { id, schedule, enabled, resolvedAccountId } = validatedInput;

  const existingTasks = await selectScheduledActions({ id });
  const existingTask = existingTasks[0];

  if (!existingTask) {
    throw new Error("Task not found");
  }

  if (existingTask.account_id !== resolvedAccountId) {
    throw new Error(TASK_ACCESS_DENIED_MESSAGE);
  }

  const updateData = Object.fromEntries(
    Object.entries(validatedInput).filter(([key, value]) => {
      if (value === undefined) return false;
      if (key === "id" || key === "resolvedAccountId") return false;
      return true;
    }),
  ) as Partial<TablesUpdate<"scheduled_actions">>;

  const finalEnabled = enabled !== undefined ? enabled : (existingTask.enabled ?? true);
  const cronExpression = schedule ?? existingTask.schedule;
  const scheduleChanged = schedule !== undefined;

  const newTriggerScheduleId = await syncTriggerSchedule({
    taskId: id,
    enabled: finalEnabled ?? existingTask.enabled ?? true,
    cronExpression,
    scheduleChanged,
    existingScheduleId: existingTask.trigger_schedule_id ?? null,
  });

  if (newTriggerScheduleId !== existingTask.trigger_schedule_id) {
    updateData.trigger_schedule_id = newTriggerScheduleId;
  }

  const updated = await updateScheduledAction({
    id,
    ...updateData,
  });

  return updated;
}
