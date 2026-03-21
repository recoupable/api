import { fetchTriggerRuns } from "@/lib/trigger/fetchTriggerRuns";

/**
 * Lists recent task runs for an account using the Trigger.dev REST API.
 *
 * @param accountId - The account ID to filter runs by
 * @param limit - Maximum number of runs to return (default 20)
 * @returns Array of run objects
 */
export async function listTaskRuns(accountId: string, limit: number = 20) {
  return fetchTriggerRuns({ "filter[tag]": `account:${accountId}` }, limit);
}
