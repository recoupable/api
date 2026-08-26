import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import type { Tables } from "@/types/database.types";
import { getTaskTriggerInfo, type TaskTriggerInfo } from "@/lib/tasks/getTaskTriggerInfo";
import { getArtistNamesById } from "@/lib/tasks/getArtistNamesById";

type ScheduledAction = Tables<"scheduled_actions">;

export type EnrichedTask = ScheduledAction &
  TaskTriggerInfo & {
    owner_email: string | null;
    /** Display name of the artist account the task runs for; null when it no longer exists (chat#2006 item 6). */
    artist_name: string | null;
  };

/**
 * Enriches tasks with Trigger.dev metadata, the owner's email and the
 * artist's display name. Coordinator only: each lookup lives in its own
 * best-effort helper and runs in parallel.
 *
 * @param tasks - Scheduled actions to enrich
 * @returns Enriched task rows for API responses
 */
export async function enrichTasks(tasks: ScheduledAction[]): Promise<EnrichedTask[]> {
  const [triggerInfos, accountEmails, artistNameById] = await Promise.all([
    Promise.all(tasks.map(task => getTaskTriggerInfo(task.trigger_schedule_id))),
    selectAccountEmails({ accountIds: [...new Set(tasks.map(task => task.account_id))] }),
    getArtistNamesById(tasks.map(task => task.artist_account_id)),
  ]);

  const emailByAccountId = new Map<string, string>(
    accountEmails.flatMap(accountEmail =>
      accountEmail.account_id && accountEmail.email
        ? [[accountEmail.account_id, accountEmail.email] as const]
        : [],
    ),
  );

  return tasks.map((task, index) => ({
    ...task,
    ...triggerInfos[index],
    artist_name: artistNameById.get(task.artist_account_id) ?? null,
    owner_email: emailByAccountId.get(task.account_id) ?? null,
  }));
}
