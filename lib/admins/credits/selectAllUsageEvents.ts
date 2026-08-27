import type { Tables } from "@/types/database.types";
import { selectUsageEvents } from "@/lib/supabase/usage_events/selectUsageEvents";

interface SelectAllUsageEventsParams {
  accountId?: string;
  /** Lower bound on `created_at` (ISO string). Omit to fetch all-time. */
  createdAfter?: string;
}

const BATCH_SIZE = 1000;

/**
 * Fetches every `usage_events` row matching the filters by paginating through
 * Supabase in 1000-row batches. Used by the admin rollup so aggregation
 * inputs don't get silently truncated by Supabase's default response cap.
 *
 * @param params - Optional filters.
 * @returns All matching usage_events rows.
 */
export async function selectAllUsageEvents(
  params: SelectAllUsageEventsParams = {},
): Promise<Tables<"usage_events">[]> {
  const all: Tables<"usage_events">[] = [];
  let offset = 0;
  while (true) {
    const batch = await selectUsageEvents({
      accountId: params.accountId,
      createdAfter: params.createdAfter,
      from: offset,
      to: offset + BATCH_SIZE - 1,
    });
    all.push(...batch);
    if (batch.length < BATCH_SIZE) return all;
    offset += BATCH_SIZE;
  }
}
