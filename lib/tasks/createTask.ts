import { insertScheduledAction } from "@/lib/supabase/scheduled_actions/insertScheduledAction";
import { updateScheduledAction } from "@/lib/supabase/scheduled_actions/updateScheduledAction";
import { deleteScheduledAction } from "@/lib/supabase/scheduled_actions/deleteScheduledAction";
import { createSchedule } from "@/lib/trigger/createSchedule";
import { createTaskPayloadSchema, type CreateTaskBody } from "@/lib/tasks/createTaskSchemas";
import { assertTaskWithinPlan } from "@/lib/plans/assertTaskWithinPlan";
import type { Tables } from "@/types/database.types";

/**
 * Creates a new task (scheduled action) in the system, after the owner's plan
 * allows one more task at this cadence (throws `PlanLimitError` otherwise).
 * Also creates the corresponding Trigger.dev schedule.
 * Attempts to remove the newly inserted row if schedule creation fails or
 * returns no ID; cleanup failure does not replace the original error.
 *
 * @param input - The task data to create (validated against createTaskPayloadSchema)
 * @returns The created task
 */
export async function createTask(input: CreateTaskBody): Promise<Tables<"scheduled_actions">> {
  const validatedInput = createTaskPayloadSchema.parse(input);
  // `timezone` lives on the Trigger.dev schedule (source of truth), not on
  // `scheduled_actions` — strip it before the insert (chat#1881 3c). `schedule`
  // stays in the insert (it's a real column) and is also used below.
  const { timezone, ...scheduledActionInput } = validatedInput;
  const { schedule } = validatedInput;

  await assertTaskWithinPlan({ accountId: validatedInput.account_id, schedule });

  // Insert the task into the database
  const tasks = await insertScheduledAction(scheduledActionInput);
  const created = tasks[0];

  if (!created || !created.id) {
    throw new Error("Failed to create task: missing Supabase id for scheduling");
  }

  // Create the Trigger.dev schedule (it interprets the cron in `timezone`,
  // DST-aware; defaults to UTC when omitted).
  let triggerSchedule: Awaited<ReturnType<typeof createSchedule>>;
  try {
    triggerSchedule = await createSchedule({
      cron: schedule,
      deduplicationKey: created.id,
      externalId: created.id,
      timezone,
    });

    if (!triggerSchedule.id) {
      throw new Error("Failed to create Trigger.dev schedule: missing schedule id");
    }
  } catch (error) {
    try {
      await deleteScheduledAction(created.id);
    } catch (cleanupError) {
      console.error("Failed to clean up task after scheduler failure:", created.id, cleanupError);
    }
    throw error;
  }

  // Update the task with the trigger schedule ID
  const updated = await updateScheduledAction({
    id: created.id,
    trigger_schedule_id: triggerSchedule.id,
  });

  return updated;
}
