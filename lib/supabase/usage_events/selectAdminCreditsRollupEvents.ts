import supabase from "@/lib/supabase/serverClient";

interface SelectAdminCreditsRollupEventsParams {
  /** Lower bound on `created_at` (ISO string). Omit to fetch all-time. */
  createdAfter?: string;
}

export interface RollupEventRow {
  account_id: string;
  credits_deducted_cents: number;
}

/**
 * Fetches the (account_id, credits_deducted_cents) projection for every
 * usage_events row in the period, so the rollup handler can aggregate by
 * account in TS. This intentionally returns raw rows rather than a
 * server-side GROUP BY because supabase-js doesn't expose PostgREST's
 * aggregate operators in a typed way; if/when row volume becomes a
 * problem, swap this for a Postgres function via a `database` repo
 * migration and call it via `supabase.rpc(...)`.
 *
 * Pages are computed in the handler, not here — we need the full set to
 * compute the correct ORDER BY total and `total_count` before slicing.
 */
export async function selectAdminCreditsRollupEvents(
  params: SelectAdminCreditsRollupEventsParams = {},
): Promise<RollupEventRow[]> {
  let query = supabase.from("usage_events").select("account_id, credits_deducted_cents");

  if (params.createdAfter) {
    query = query.gte("created_at", params.createdAfter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error selecting usage_events for admin rollup:", error);
    throw error;
  }

  return data ?? [];
}
