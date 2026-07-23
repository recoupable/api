import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { fetchTriggerRuns, type TriggerRun } from "@/lib/trigger/fetchTriggerRuns";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";
import { retrieveScheduleTimezone } from "@/lib/trigger/retrieveScheduleTimezone";
import type { Tables } from "@/types/database.types";

type ScheduledAction = Tables<"scheduled_actions">;

export type EnrichedTask = ScheduledAction & {
  recent_runs: TriggerRun[];
  upcoming: string[];
  owner_email: string | null;
  /** IANA timezone read from the Trigger.dev schedule (source of truth); null when unavailable. */
  timezone: string | null;
};

interface TriggerInfo {
  recent_runs: TriggerRun[];
  upcoming: string[];
  timezone: string | null;
}

type TriggerInfoEntry = readonly [string, TriggerInfo];

/**
 * Enriches tasks with Trigger.dev metadata and owner email.
 *
 * @param tasks - Scheduled actions to enrich
 * @returns Enriched task rows for API responses
 */
export async function enrichTasks(tasks: ScheduledAction[]): Promise<EnrichedTask[]> {
  const triggerInfoEntriesPromise: Promise<TriggerInfoEntry[]> = Promise.all(
    tasks.map(async (task): Promise<TriggerInfoEntry> => {
      const scheduleId = task.trigger_schedule_id;

      if (!scheduleId) {
        return [task.id, { recent_runs: [], upcoming: [], timezone: null }] as const;
      }

      try {
        // The schedule owns the timezone (chat#1881 3c) — read it back so the
        // edit UI can prefill the current zone. Runs in parallel with the runs.
        const [recentRuns, timezone] = await Promise.all([
          fetchTriggerRuns({ "filter[schedule]": scheduleId }, 5),
          retrieveScheduleTimezone(scheduleId),
        ]);

        let upcoming: string[] = [];

        const latestRun = recentRuns[0];
        if (latestRun) {
          try {
            const fullRun = await retrieveTaskRun(latestRun.id);
            const payload = fullRun?.payload as { upcoming?: unknown[] } | undefined;
            if (Array.isArray(payload?.upcoming)) {
              upcoming = payload.upcoming.filter(
                (item): item is string => typeof item === "string",
              );
            }
          } catch {
            // payload retrieval failed — skip upcoming
          }
        }

        return [
          task.id,
          { recent_runs: recentRuns, upcoming, timezone: timezone ?? null },
        ] as const;
      } catch {
        // Trigger.dev API failed — return task without trigger enrichment
        return [task.id, { recent_runs: [], upcoming: [], timezone: null }] as const;
      }
    }),
  );

  const [triggerInfoEntries, accountEmails] = await Promise.all([
    triggerInfoEntriesPromise,
    selectAccountEmails({
      accountIds: [...new Set(tasks.map(task => task.account_id))],
    }),
  ]);

  const emailByAccountId = new Map<string, string>(
    accountEmails.flatMap(accountEmail =>
      accountEmail.account_id && accountEmail.email
        ? [[accountEmail.account_id, accountEmail.email] as const]
        : [],
    ),
  );

  const triggerInfoMap = new Map<string, TriggerInfo>(triggerInfoEntries);

  return tasks.map(task => ({
    ...task,
    ...triggerInfoMap.get(task.id)!,
    owner_email: emailByAccountId.get(task.account_id) ?? null,
  }));
}
