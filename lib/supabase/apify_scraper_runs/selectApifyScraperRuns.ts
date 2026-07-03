import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Select apify_scraper_runs rows, optionally filtered by run id.
 *
 * @param runId - Apify run id to filter by
 * @returns Matching rows, or null on error
 */
export async function selectApifyScraperRuns({
  runId,
}: {
  runId?: string;
} = {}): Promise<Tables<"apify_scraper_runs">[] | null> {
  let query = supabase.from("apify_scraper_runs").select("*");

  if (runId) {
    query = query.eq("run_id", runId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching apify_scraper_runs:", error);
    return null;
  }

  return data || [];
}
