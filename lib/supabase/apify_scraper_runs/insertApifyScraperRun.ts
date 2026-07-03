import supabase from "@/lib/supabase/serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

/**
 * Records which account started an Apify scraper run (recoupable/chat#1840).
 * Read by the GET /api/apify/runs/{runId} validator to authorize the owner.
 *
 * @param run - The run ownership row to insert
 * @returns The inserted row, or null on error
 */
export async function insertApifyScraperRun(
  run: TablesInsert<"apify_scraper_runs">,
): Promise<Tables<"apify_scraper_runs"> | null> {
  const { data, error } = await supabase.from("apify_scraper_runs").insert(run).select().single();

  if (error) {
    console.error("Error inserting apify_scraper_runs:", error);
    return null;
  }

  return data;
}
