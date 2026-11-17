import apifyClient from "@/lib/apify/client";

export interface ScraperRunResults {
  status: string;
  dataset_id: string | null;
  data?: unknown[];
}

/**
 * Reads an Apify scrape run's status and, once it has SUCCEEDED, its dataset
 * items. Shared by `GET /api/apify/runs/{runId}` and the
 * `get_scraper_results` MCP tool.
 *
 * @param runId - The Apify run id returned when the scrape started.
 * @returns `{ status, dataset_id, data? }`; `data` is present only for a
 * SUCCEEDED run whose dataset returned items.
 */
export async function getScraperRunResults(runId: string): Promise<ScraperRunResults> {
  const run = await apifyClient.run(runId).get();
  const status = run?.status ?? "UNKNOWN";
  const dataset_id = run?.defaultDatasetId ?? null;

  if (status === "SUCCEEDED" && dataset_id) {
    const result = await apifyClient.dataset(dataset_id).listItems();
    if (result?.items) return { status, dataset_id, data: result.items };
  }

  return { status, dataset_id };
}
