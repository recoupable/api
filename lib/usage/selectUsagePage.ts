import type { Tables } from "@/types/database.types";
import { selectUsageEvents } from "@/lib/supabase/usage_events/selectUsageEvents";
import type { UsageCursor, UsageSort } from "@/lib/usage/usageSort";
import { normalizeUsageTimestamp } from "@/lib/usage/normalizeUsageTimestamp";

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
 * Both sorts page by their sort key and ID, within the requested period.
 * Legacy timestamp-only cursors remain strict time boundaries.
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
      costBefore: params.cursor && "creditsDeducted" in params.cursor ? params.cursor : undefined,
      ...range,
    });
  }
  const cursor = params.cursor && "createdAt" in params.cursor ? params.cursor : undefined;
  const legacyAt = cursor && !cursor.id ? cursor.createdAt : undefined;
  const createdBefore =
    legacyAt && normalizeUsageTimestamp(legacyAt) < normalizeUsageTimestamp(params.to)
      ? legacyAt
      : params.to;
  return selectUsageEvents({
    accountId: params.accountId,
    createdAfter: params.from,
    createdBefore,
    orderBy: "created_at",
    ...(cursor?.id ? { timeBefore: { createdAt: cursor.createdAt, id: cursor.id } } : {}),
    ...range,
  });
}
