import apifyClient from "@/lib/apify/client";

/**
 * Fetches the status of an Apify actor run via the Apify SDK.
 *
 * Projects the SDK's camelCase `defaultDatasetId` to wire-shape `dataset_id`
 * (snake_case per mono/api repo convention).
 *
 * This intentionally does NOT preserve the legacy Express helper's behaviour of
 * silently returning `{ status: "RUNNING", dataset_id: "" }` on transport
 * errors. Callers (e.g. tasks polling loops) depend on distinguishing a real
 * "RUNNING" state from an upstream outage; swallowing throws here was the
 * documented bug that the migration is deliberately fixing. Let errors
 * propagate so the handler can respond 500 cleanly.
 *
 * @param runId - The Apify run identifier.
 * @returns The run status plus its default dataset id (or `null` when the run
 *   has not yet allocated a dataset).
 */
export async function getActorStatus(runId: string) {
  const run = await apifyClient.run(runId).get();
  return {
    status: run?.status ?? "UNKNOWN",
    dataset_id: run?.defaultDatasetId ?? null,
  };
}

export default getActorStatus;
