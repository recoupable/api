import type { Tables } from "@/types/database.types";
import { selectUsageEvents } from "@/lib/supabase/usage_events/selectUsageEvents";
import type { UsageCursor, UsageSort } from "@/lib/usage/usageSort";

interface SelectUsagePageParams {
  accountId: string;
  from: string;
  to: string;
  sort: UsageSort;
  cursor: UsageCursor | undefined;
  limit: number;
}

/**
 * One page of an account's charges in the period, continuing after `cursor`.
 * Sorted by time, the cursor tightens the period's upper bound; sorted by
 * cost, the whole period is scanned and the keyset pair does the paging.
 *
 * @param params - Period, sort, decoded cursor and page size.
 * @returns Up to `limit` rows.
 */
export function selectUsagePage(params: SelectUsagePageParams): Promise<Tables<"usage_events">[]> {
  const range = { from: 0, to: params.limit - 1 };
  if (params.sort === "cost") {
    return selectUsageEvents({
      accountId: params.accountId,
      createdAfter: params.from,
      createdBefore: params.to,
      orderBy: "credits_deducted",
      costBefore: params.cursor && "id" in params.cursor ? params.cursor : undefined,
      ...range,
    });
  }
  const cursorAt =
    params.cursor && "createdAt" in params.cursor ? params.cursor.createdAt : undefined;
  const createdBefore = cursorAt && new Date(cursorAt) < new Date(params.to) ? cursorAt : params.to;
  return selectUsageEvents({
    accountId: params.accountId,
    createdAfter: params.from,
    createdBefore,
    orderBy: "created_at",
    ...range,
  });
}
