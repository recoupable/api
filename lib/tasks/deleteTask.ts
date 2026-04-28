import { deleteScheduledAction } from "@/lib/supabase/scheduled_actions/deleteScheduledAction";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { deleteSchedule } from "@/lib/trigger/deleteSchedule";

export const TASK_ACCESS_DENIED_MESSAGE = "Access denied to this task";

/**
 * Deletes a task (scheduled action) by its ID.
 * Also deletes the corresponding Trigger.dev schedule if it exists.
 *
 * @param input - The input object containing the task ID to delete
 * @param input.id - The UUID of the task to delete
 */
export async function deleteTask(input: { id: string; resolvedAccountId: string }): Promise<void> {
  const { id, resolvedAccountId } = input;

  // Get scheduled action to check for trigger_schedule_id
  const scheduledActions = await selectScheduledActions({ id });
  const scheduledAction = scheduledActions[0];

  if (!scheduledAction) {
    throw new Error("Task not found");
  }

  if (scheduledAction.account_id !== resolvedAccountId) {
    throw new Error(TASK_ACCESS_DENIED_MESSAGE);
  }

  // Delete from Trigger.dev and database in parallel - they're independent
  await Promise.all([
    scheduledAction.trigger_schedule_id
      ? deleteSchedule(scheduledAction.trigger_schedule_id)
      : Promise.resolve(),
    deleteScheduledAction(id),
  ]);
}
