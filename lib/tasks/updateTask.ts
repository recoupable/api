import { updateScheduledAction } from "@/lib/supabase/scheduled_actions/updateScheduledAction";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { syncTriggerSchedule } from "@/lib/trigger/syncTriggerSchedule";
import { updateTaskBodySchema, type UpdateTaskBody } from "@/lib/tasks/validateUpdateTaskBody";
import type { Tables, TablesUpdate } from "@/types/database.types";

/**
 * Updates an existing task (scheduled action) in the system.
 * If schedule is updated, the corresponding Trigger.dev schedule is also updated.
 *
 * @param input - The task data to update (validated against updateTaskBodySchema)
 * @returns The updated task
 */
export async function updateTask(input: UpdateTaskBody): Promise<Tables<"scheduled_actions">> {
  // Validate input using schema
  const validatedInput = updateTaskBodySchema.parse(input);
  const { id, schedule, enabled } = validatedInput;

  // Get existing task
  const existingTasks = await selectScheduledActions({ id });
  const existingTask = existingTasks[0];

  if (!existingTask) {
    throw new Error("Task not found");
  }

  // Prepare update data - only include fields that are defined
  const updateData: Partial<TablesUpdate<"scheduled_actions">> = {};
  if (validatedInput.title !== undefined) updateData.title = validatedInput.title;
  if (validatedInput.prompt !== undefined) updateData.prompt = validatedInput.prompt;
  if (schedule !== undefined) updateData.schedule = schedule;
  if (validatedInput.account_id !== undefined) updateData.account_id = validatedInput.account_id;
  if (validatedInput.artist_account_id !== undefined)
    updateData.artist_account_id = validatedInput.artist_account_id;
  if (enabled !== undefined) updateData.enabled = enabled;
  if (validatedInput.model !== undefined) updateData.model = validatedInput.model;

  // Sync Trigger.dev schedule if needed
  const finalEnabled = enabled !== undefined ? enabled : (existingTask.enabled ?? true);
  const cronExpression = schedule ?? existingTask.schedule ?? undefined;
  const scheduleChanged = schedule !== undefined;

  const newTriggerScheduleId = await syncTriggerSchedule({
    taskId: id,
    enabled: finalEnabled,
    cronExpression,
    scheduleChanged,
    existingScheduleId: existingTask.trigger_schedule_id ?? null,
  });

  if (newTriggerScheduleId !== existingTask.trigger_schedule_id) {
    updateData.trigger_schedule_id = newTriggerScheduleId;
  }

  // Update the task
  const updated = await updateScheduledAction({
    id,
    ...updateData,
  });

  return updated;
}
