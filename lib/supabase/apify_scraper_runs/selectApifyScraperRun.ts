import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

type SelectApifyScraperRunParams = {
  /** One run by Apify run id. */
  runId?: string;
  /** Every run whose `parent_run_id` is one of these — one generation of a chain. */
  parentRunIds?: string[];
};

/**
 * Registered scrape runs, filtered by run id and/or parent run ids. An
 * explicit empty `parentRunIds` returns [] without querying. A run that was
 * never registered (a chain rooted before lineage shipped) simply yields no row.
 */
export async function selectApifyScraperRun({
  runId,
  parentRunIds,
}: SelectApifyScraperRunParams = {}): Promise<Tables<"apify_scraper_runs">[]> {
  if (parentRunIds !== undefined && parentRunIds.length === 0) return [];

  let query = supabase.from("apify_scraper_runs").select("*");
  if (runId) query = query.eq("run_id", runId);
  if (parentRunIds) query = query.in("parent_run_id", parentRunIds);

  const { data, error } = await query;
  if (error) {
    console.error("[ERROR] selectApifyScraperRun:", error);
    throw error;
  }
  return data ?? [];
}
