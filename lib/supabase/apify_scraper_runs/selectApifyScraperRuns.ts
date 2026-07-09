import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Select scrape runs with optional filters.
 *
 * @param batchId - Return the runs registered under this digest batch.
 */
export async function selectApifyScraperRuns({
  batchId,
}: {
  batchId?: string;
} = {}): Promise<Tables<"apify_scraper_runs">[]> {
  let query = supabase.from("apify_scraper_runs").select("*");

  if (batchId) {
    query = query.eq("batch_id", batchId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[ERROR] selectApifyScraperRuns:", error);
    return [];
  }
  return data ?? [];
}
