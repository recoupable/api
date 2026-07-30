import type { Tables } from "@/types/database.types";

/**
 * Scraper spend for the current calendar month, in USD.
 *
 * The caller's snapshot lookup can reach into the previous month (the reuse
 * window crosses the boundary), so rows are filtered by `monthStart` here
 * rather than relying on the query's lower bound (chat#1912 row 4).
 */
export function getMonthlySpendUsd(
  snapshots: Tables<"playcount_snapshots">[],
  monthStart: Date,
): number {
  return snapshots
    .filter(row => !!row.created_at && new Date(row.created_at) >= monthStart)
    .reduce((sum, row) => sum + (row.estimated_cost_usd ?? 0), 0);
}
