import type { UsageCursor, UsageSort } from "@/lib/usage/usageSort";

const COST_CURSOR = /^(\d+):(.+)$/;

/**
 * Parses a `cursor` for the given sort: an ISO timestamp for `created_at`
 * (normalised to UTC), `<credits_deducted>:<id>` for `cost`.
 *
 * @param sort - The sort the cursor was issued under.
 * @param cursor - The raw query value.
 * @returns The keyset, or null when the cursor does not fit the sort.
 */
export function decodeUsageCursor(sort: UsageSort, cursor: string): UsageCursor | null {
  if (sort === "cost") {
    const match = COST_CURSOR.exec(cursor);
    return match ? { creditsDeducted: Number(match[1]), id: match[2] } : null;
  }
  const time = Date.parse(cursor);
  if (Number.isNaN(time) || COST_CURSOR.test(cursor)) return null;
  return { createdAt: new Date(time).toISOString() };
}
