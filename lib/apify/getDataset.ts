import apifyClient from "@/lib/apify/client";

/**
 * Fetches items from an Apify dataset by id via the SDK. Returns the
 * items array; errors propagate to the caller so the webhook handler
 * can surface them in its error response.
 *
 * @param datasetId - Apify dataset id.
 */
export async function getDataset(datasetId: string) {
  const { items } = await apifyClient.dataset(datasetId).listItems();
  return items;
}
