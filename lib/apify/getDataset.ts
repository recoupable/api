/**
 * Fetches items from an Apify dataset by id. Uses the REST endpoint
 * rather than the SDK so we do not have to materialize the whole
 * dataset client just to pull items.
 *
 * @param datasetId - Apify dataset id.
 * @returns Parsed dataset body (array) or `[]` on failure.
 */
export async function getDataset(datasetId: string): Promise<unknown[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.error("[ERROR] getDataset: missing APIFY_TOKEN");
    return [];
  }

  const response = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );

  if (!response.ok) {
    console.error(`[ERROR] getDataset: ${response.status} ${response.statusText}`);
    return [];
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
