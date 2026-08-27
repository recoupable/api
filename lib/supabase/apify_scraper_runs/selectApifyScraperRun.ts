import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Fetches one registered scrape run by Apify run id, or null when the run
 * was never registered (a chain rooted before lineage shipped).
 *
 * @param runId - Apify run id.
 */
export async function selectApifyScraperRun(
  runId: string,
): Promise<Tables<"apify_scraper_runs"> | null> {
  const { data, error } = await supabase
    .from("apify_scraper_runs")
    .select("*")
    .eq("run_id", runId)
    .maybeSingle();
  if (error) {
    console.error("[ERROR] selectApifyScraperRun:", error);
    throw error;
  }
  return data ?? null;
}
