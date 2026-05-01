import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { fetchTriggerRuns, type TriggerRun } from "@/lib/trigger/fetchTriggerRuns";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";
import type { Tables } from "@/types/database.types";

type ScheduledAction = Tables<"scheduled_actions">;

export type EnrichedTask = ScheduledAction & {
  recent_runs: TriggerRun[];
  upcoming: string[];
  owner_email: string | null;
};

interface TriggerInfo {
  recent_runs: TriggerRun[];
  upcoming: string[];
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
        return [task.id, { recent_runs: [], upcoming: [] }] as const;
      }

      try {
        const recentRuns = await fetchTriggerRuns({ "filter[schedule]": scheduleId }, 5);

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

        return [task.id, { recent_runs: recentRuns, upcoming }] as const;
      } catch {
        // Trigger.dev API failed — return task without trigger enrichment
        return [task.id, { recent_runs: [], upcoming: [] }] as const;
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
