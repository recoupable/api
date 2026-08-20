import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

/**
 * Select snapshot job rows with optional filters — by account (per-org cap
 * window), creation lower bound, and schedule (due monthly re-runs).
 *
 * @param params.id - Optional snapshot id filter
 * @param params.account - Optional account filter
 * @param params.catalog - Optional catalog filter (runs materialized into a catalog)
 * @param params.catalogs - Optional multi-catalog filter, for list reads that
 *   would otherwise issue one query per catalog
 * @param params.createdAfter - Optional inclusive created_at lower bound (ISO)
 * @param params.schedule - Optional schedule filter ("once" | "monthly")
 * @param params.limit - Optional maximum rows to return (newest-first)
 * @returns Matching rows newest-first (ties broken by id so limited reads are
 *   stable across requests), or [] if none exist
 * @throws Error on query error — a database failure must never read as "no
 *   rows" (the empty-vs-error conflation class, chat#1965)
 */
export async function selectPlaycountSnapshots({
  id,
  account,
  catalog,
  catalogs,
  createdAfter,
  schedule,
  limit,
}: {
  id?: string;
  account?: string;
  catalog?: string;
  catalogs?: string[];
  createdAfter?: string;
  schedule?: string;
  limit?: number;
}): Promise<Tables<"playcount_snapshots">[]> {
  let query = supabase
    .from("playcount_snapshots")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (id) query = query.eq("id", id);
  if (account) query = query.eq("account", account);
  if (catalog) query = query.eq("catalog", catalog);
  if (catalogs) {
    if (!catalogs.length) return [];
    query = query.in("catalog", catalogs);
  }
  if (schedule) query = query.eq("schedule", schedule);
  if (createdAfter) query = query.gte("created_at", createdAfter);
  if (limit) query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch playcount_snapshots: ${error.message}`);
  }

  return data || [];
}
