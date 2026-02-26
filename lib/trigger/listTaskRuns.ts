import { runs } from "@trigger.dev/sdk/v3";

/**
 * Lists recent task runs for an account by querying the Trigger.dev API
 * using the `account:<accountId>` tag.
 *
 * @param accountId - The account ID to filter runs by
 * @param limit - Maximum number of runs to return (default 20)
 * @returns Array of raw task runs from the SDK
 */
export async function listTaskRuns(accountId: string, limit: number = 20) {
  const tag = `account:${accountId}`;

  const result = await runs.list({
    tag: [tag],
    limit,
  });

  return result.data;
}
