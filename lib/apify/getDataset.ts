import apifyClient from "@/lib/apify/client";

/**
 * Fetches the items of an Apify dataset via the Apify SDK.
 *
 * Returns `null` only when the SDK returns a null result; actual transport
 * errors propagate so the handler can respond 500.
 *
 * @param datasetId - The Apify dataset identifier.
 * @returns The list of items, or `null` if the SDK returned no result.
 */
export async function getDataset(datasetId: string): Promise<unknown[] | null> {
  const result = await apifyClient.dataset(datasetId).listItems();
  if (!result) return null;
  return result.items as unknown[];
}

export default getDataset;
