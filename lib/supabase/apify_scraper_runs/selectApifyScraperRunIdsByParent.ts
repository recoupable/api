import supabase from "@/lib/supabase/serverClient";

/**
 * Run ids whose `parent_run_id` is one of `parentRunIds` — one generation
 * of a run chain. Returns [] for an empty input without querying.
 */
export async function selectApifyScraperRunIdsByParent(parentRunIds: string[]): Promise<string[]> {
  if (parentRunIds.length === 0) return [];
  const { data, error } = await supabase
    .from("apify_scraper_runs")
    .select("run_id")
    .in("parent_run_id", parentRunIds);
  if (error) {
    console.error("[ERROR] selectApifyScraperRunIdsByParent:", error);
    throw error;
  }
  return (data ?? []).map(r => r.run_id);
}
