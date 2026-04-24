import apifyClient from "@/lib/apify/client";

/**
 * Returns the items of an Apify dataset, or null on error.
 *
 * @param datasetId - Apify dataset id.
 */
export async function getDataset(datasetId: string): Promise<unknown[] | null> {
  try {
    const result = await apifyClient.dataset(datasetId).listItems();
    return result?.items ?? [];
  } catch (error) {
    console.error("[ERROR] getDataset:", error);
    return null;
  }
}
