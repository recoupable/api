import supabase from "../serverClient";

/**
 * Sum Songstats hits spent since a window start (the rolling 30-day quota
 * check). Errors are treated as the full quota being spent — failing safe:
 * the worker must never overspend because the ledger was unreadable.
 *
 * @param since - Inclusive ISO lower bound of the window
 * @returns Total hits spent in the window
 */
export async function selectSongstatsQuotaSpent(since: string): Promise<number> {
  const { data, error } = await supabase
    .from("songstats_quota_ledger")
    .select("hits")
    .gte("spent_at", since);

  if (error) {
    console.error("Error reading songstats quota ledger:", error);
    return Number.MAX_SAFE_INTEGER;
  }

  return (data || []).reduce((sum, row) => sum + row.hits, 0);
}
