import { deleteScheduledAction } from "@/lib/supabase/scheduled_actions/deleteScheduledAction";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { deleteSchedule } from "@/lib/trigger/deleteSchedule";

/**
 * Deletes a task (scheduled action) by its ID.
 * Also deletes the corresponding Trigger.dev schedule if it exists.
 *
 * @param input - The input object containing the task ID to delete
 * @param input.id - The UUID of the task to delete
 */
export async function deleteTask(input: { id: string }): Promise<void> {
  const { id } = input;

  // Get scheduled action to check for trigger_schedule_id
  const scheduledActions = await selectScheduledActions({ id });
  const scheduledAction = scheduledActions[0];

  if (!scheduledAction) {
    throw new Error("Task not found");
  }

  // Delete from Trigger.dev if schedule exists
  if (scheduledAction.trigger_schedule_id) {
    await deleteSchedule(scheduledAction.trigger_schedule_id);
  }

  // Delete from database
  await deleteScheduledAction(id);
}
