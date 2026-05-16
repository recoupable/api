import type { Tables } from "@/types/database.types";
import { selectUsageEventsRange } from "./selectUsageEventsRange";

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
 * deterministic tiebreaker.
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
): Promise<Tables<"usage_events">[]> {
  const { accountId, createdAfter, page, limit } = params;

  if (page !== undefined && limit !== undefined) {
    const offset = (page - 1) * limit;
    return selectUsageEventsRange({
      accountId,
      createdAfter,
      from: offset,
      to: offset + limit - 1,
    });
  }

  const all: Tables<"usage_events">[] = [];
  let offset = 0;
  while (true) {
    const batch = await selectUsageEventsRange({
      accountId,
      createdAfter,
      from: offset,
      to: offset + FETCH_ALL_BATCH_SIZE - 1,
    });
    all.push(...batch);
    if (batch.length < FETCH_ALL_BATCH_SIZE) return all;
    offset += FETCH_ALL_BATCH_SIZE;
  }
}
