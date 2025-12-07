import { insertScheduledAction } from "@/lib/supabase/scheduled_actions/insertScheduledAction";
import { updateScheduledAction } from "@/lib/supabase/scheduled_actions/updateScheduledAction";
import { createSchedule } from "@/lib/trigger/createSchedule";
import type { Tables } from "@/types/database.types";

export type CreateTaskInput = {
  title: string;
  prompt: string;
  schedule: string;
  account_id: string;
  artist_account_id: string;
  model?: string;
};

/**
 * Creates a new task (scheduled action) in the system.
 * Also creates the corresponding Trigger.dev schedule.
 *
 * @param input - The task data to create
 * @returns The created task
 */
export async function createTask(input: CreateTaskInput): Promise<Tables<"scheduled_actions">> {
  const { schedule } = input;

  // Insert the task into the database
  const tasks = await insertScheduledAction(input);
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
