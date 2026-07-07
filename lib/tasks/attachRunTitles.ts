import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import type { TriggerRun } from "@/lib/trigger/fetchTriggerRuns";
import { buildRunTitleMap } from "./buildRunTitleMap";

export type TaskRunWithTitle = TriggerRun & { title: string | null };

/**
 * Annotates Trigger.dev runs with the title of the scheduled action that
 * triggered them. Titles are resolved by matching run ids against each of
 * the account's schedules (see buildRunTitleMap); runs that cannot be
 * mapped (e.g. non-scheduled runs) get title null.
 *
 * Fails open: if the scheduled_actions lookup or title resolution fails,
 * every run is returned with title null so the runs list never breaks.
 *
 * @param runs - Runs from the account-tag list fetch
 * @param accountId - The account whose scheduled actions to resolve against
 * @param limit - Runs to fetch per schedule (match the list page size)
 * @returns The same runs, each with a title field (null when unresolvable)
 */
export async function attachRunTitles(
  runs: TriggerRun[],
  accountId: string,
  limit: number,
): Promise<TaskRunWithTitle[]> {
  if (runs.length === 0) {
    return [];
  }

  try {
    const actions = await selectScheduledActions({ account_id: accountId });
    const titleByRunId = await buildRunTitleMap(actions, limit);
    return runs.map(run => ({ ...run, title: titleByRunId.get(run.id) ?? null }));
  } catch (error) {
    console.error("Error resolving task run titles:", error);
    return runs.map(run => ({ ...run, title: null }));
  }
}
