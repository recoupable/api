import { fetchTriggerRuns } from "@/lib/trigger/fetchTriggerRuns";

export type RunTitleSource = {
  title: string;
  trigger_schedule_id: string | null;
};

/**
 * Builds a run-id → task-title map by fetching each scheduled action's
 * recent Trigger.dev runs via the schedule filter. Trigger.dev list runs
 * carry no schedule reference, so this reverse lookup is how a run is
 * linked back to its originating scheduled action.
 *
 * Fails open per action: a failed Trigger.dev fetch contributes no
 * entries instead of breaking the whole map.
 *
 * @param actions - Scheduled actions (title + trigger_schedule_id)
 * @param limit - Runs to fetch per schedule (match the list page size)
 * @returns Map of Trigger.dev run id to the originating task's title
 */
export async function buildRunTitleMap(
  actions: RunTitleSource[],
  limit: number,
): Promise<Map<string, string>> {
  const entriesPerAction = await Promise.all(
    actions
      .filter(action => action.trigger_schedule_id)
      .map(async (action): Promise<(readonly [string, string])[]> => {
        try {
          const runs = await fetchTriggerRuns(
            { "filter[schedule]": action.trigger_schedule_id as string },
            limit,
          );
          return runs.map(run => [run.id, action.title] as const);
        } catch {
          // Trigger.dev fetch failed for this schedule — skip its titles
          return [];
        }
      }),
  );

  return new Map(entriesPerAction.flat());
}
