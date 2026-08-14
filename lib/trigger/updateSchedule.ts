import { schedules } from "@trigger.dev/sdk";

type UpdateScheduleParams = {
  scheduleId: string;
  cron: string;
  externalId: string;
  /** IANA timezone the cron is interpreted in (DST-aware). Omitted leaves it unchanged. */
  timezone?: string;
};

/**
 * Updates an existing Trigger.dev schedule with a new cron expression (and
 * optionally its timezone). Includes externalId to prevent it from being
 * cleared during updates. The Trigger.dev schedule is the source of truth for
 * the timezone (chat#1881 3c) — we never persist a copy.
 *
 * @param params - The schedule update parameters
 */
export async function updateSchedule(params: UpdateScheduleParams): Promise<void> {
  await schedules.update(params.scheduleId, {
    task: "customer-prompt-task",
    cron: params.cron,
    externalId: params.externalId,
    ...(params.timezone ? { timezone: params.timezone } : {}),
  });
}
