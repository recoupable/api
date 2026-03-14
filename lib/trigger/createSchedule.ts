import { schedules } from "@trigger.dev/sdk";

type CreateScheduleParams = {
  cron: string;
  deduplicationKey: string;
  externalId?: string;
  timezone?: string;
};

/**
 * Creates a Trigger.dev schedule for a task
 *
 * @param params - The schedule parameters
 * @returns The created schedule
 */
export async function createSchedule(params: CreateScheduleParams) {
  const schedule = await schedules.create({
    task: "customer-prompt-task",
    cron: params.cron,
    deduplicationKey: params.deduplicationKey,
    externalId: params.externalId,
    timezone: params.timezone || "UTC",
  });
  return schedule;
}
