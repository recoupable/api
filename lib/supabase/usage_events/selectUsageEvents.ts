import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

type UsageEvent = Tables<"usage_events">;

interface SelectUsageEventsParams {
  accountId?: string;
  /** Lower bound on `created_at` (ISO string). Omit to fetch all-time. */
  createdAfter?: string;
  /** 1-indexed page. Omit to fetch every matching row (paginated internally). */
  page?: number;
  /** Page size. Required when `page` is set; also used as internal batch size when fetching all. */
  limit?: number;
}

const FETCH_ALL_BATCH_SIZE = 1000;

/**
 * Selects `usage_events` rows, optionally filtered by account and/or
 * `created_at >=` cutoff. Sorted by `created_at` DESC with `id` DESC as a
 * deterministic tiebreaker so callers can paginate without rows shuffling
 * or duplicating across pages.
 *
 * When `page` + `limit` are provided, returns just that page. When both
 * are omitted, paginates internally until the full result set is fetched —
 * avoids Supabase's default 1000-row response cap silently truncating
 * aggregate inputs.
 *
 * @param params - Filters + pagination.
 * @returns Matching usage_events rows.
 */
export async function selectUsageEvents(
  params: SelectUsageEventsParams = {},
): Promise<UsageEvent[]> {
  if (params.page !== undefined && params.limit !== undefined) {
    const offset = (params.page - 1) * params.limit;
    return runQuery(params, offset, offset + params.limit - 1);
  }

  const all: UsageEvent[] = [];
  let offset = 0;
  while (true) {
    const batch = await runQuery(params, offset, offset + FETCH_ALL_BATCH_SIZE - 1);
    all.push(...batch);
    if (batch.length < FETCH_ALL_BATCH_SIZE) return all;
    offset += FETCH_ALL_BATCH_SIZE;
  }
}

async function runQuery(
  params: SelectUsageEventsParams,
  from: number,
  to: number,
): Promise<UsageEvent[]> {
  let query = supabase
    .from("usage_events")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (params.accountId) query = query.eq("account_id", params.accountId);
  if (params.createdAfter) query = query.gte("created_at", params.createdAfter);

  const { data, error } = await query;
  if (error) {
    console.error("Error selecting usage_events:", error);
    throw error;
  }
  return data ?? [];
}
