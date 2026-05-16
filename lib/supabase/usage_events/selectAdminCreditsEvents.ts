import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

interface SelectAdminCreditsEventsParams {
  accountId: string;
  /** Lower bound on `created_at` (ISO string). Omit to fetch all-time. */
  createdAfter?: string;
  /** 1-indexed page. */
  page: number;
  limit: number;
}

export interface SelectAdminCreditsEventsResult {
  rows: Tables<"usage_events">[];
  totalCount: number;
}

/**
 * Paginated SELECT of `usage_events` rows for a single account, sorted by
 * `created_at` descending. Returns the page plus the total row count for
 * the (account, period) pair so the handler can build the `total_count`
 * field that drives the admin drilldown's "load more" affordance.
 */
export async function selectAdminCreditsEvents(
  params: SelectAdminCreditsEventsParams,
): Promise<SelectAdminCreditsEventsResult> {
  const offset = (params.page - 1) * params.limit;

  let rowsQuery = supabase
    .from("usage_events")
    .select("*")
    .eq("account_id", params.accountId)
    .order("created_at", { ascending: false })
    .range(offset, offset + params.limit - 1);

  let countQuery = supabase
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("account_id", params.accountId);

  if (params.createdAfter) {
    rowsQuery = rowsQuery.gte("created_at", params.createdAfter);
    countQuery = countQuery.gte("created_at", params.createdAfter);
  }

  const [rowsResult, countResult] = await Promise.all([rowsQuery, countQuery]);

  if (rowsResult.error) {
    console.error("Error selecting usage_events for admin events drilldown:", rowsResult.error);
    throw rowsResult.error;
  }
  if (countResult.error) {
    console.error("Error counting usage_events for admin events drilldown:", countResult.error);
    throw countResult.error;
  }

  return {
    rows: rowsResult.data ?? [],
    totalCount: countResult.count ?? 0,
  };
}
