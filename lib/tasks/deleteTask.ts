import { deleteScheduledAction } from "@/lib/supabase/scheduled_actions/deleteScheduledAction";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { deleteSchedule } from "@/lib/trigger/deleteSchedule";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

export const TASK_ACCESS_DENIED_MESSAGE = "Access denied to this task";

/**
 * Deletes a task (scheduled action) by its ID, when the caller can access the
 * account that owns it: their own account, one sharing an organization, or
 * any account for a Recoup admin (`canAccessAccount`). The row names its
 * owner, so no body `account_id` is needed (app#2016 item 2).
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

  const allowed = await canAccessAccount({
    currentAccountId: resolvedAccountId,
    targetAccountId: scheduledAction.account_id,
  });
  if (!allowed) {
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
