import { insertScheduledAction } from "@/lib/supabase/scheduled_actions/insertScheduledAction";
import { updateScheduledAction } from "@/lib/supabase/scheduled_actions/updateScheduledAction";
import { createSchedule } from "@/lib/trigger/createSchedule";
import { createTaskBodySchema, type CreateTaskBody } from "@/lib/tasks/validateCreateTaskBody";
import type { Tables } from "@/types/database.types";

/**
 * Creates a new task (scheduled action) in the system.
 * Also creates the corresponding Trigger.dev schedule.
 *
 * @param input - The task data to create (validated against createTaskBodySchema)
 * @returns The created task
 */
export async function createTask(input: CreateTaskBody): Promise<Tables<"scheduled_actions">> {
  // Validate input using schema
  const validatedInput = createTaskBodySchema.parse(input);
  const { schedule } = validatedInput;

  // Insert the task into the database
  const tasks = await insertScheduledAction(validatedInput);
  const created = tasks[0];

  if (!created || !created.id) {
    throw new Error("Failed to create task: missing Supabase id for scheduling");
  }

  // Create the Trigger.dev schedule
  const triggerSchedule = await createSchedule({
    cron: schedule,
    deduplicationKey: created.id,
    externalId: created.id,
  });

  if (!triggerSchedule.id) {
    throw new Error("Failed to create Trigger.dev schedule: missing schedule id");
  }

  // Update the task with the trigger schedule ID
  const updated = await updateScheduledAction({
    id: created.id,
    trigger_schedule_id: triggerSchedule.id,
  });

  return updated;
}
