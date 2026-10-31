import type { UsageSort } from "@/lib/usage/usageSort";
import { normalizeUsageTimestamp } from "@/lib/usage/normalizeUsageTimestamp";

/**
 * Time paging retains the last row's timestamp and ID in a versioned opaque
 * token. Cost paging keeps the existing `<credits_deducted>:<id>` contract.
 *
 * @param sort - The page's sort.
 * @param last - The last item on the page.
 * @returns The cursor string.
 */
export function encodeUsageCursor(
  sort: UsageSort,
  last: { id: string; created_at: string; credits_deducted: number },
): string {
  return sort === "cost"
    ? `${last.credits_deducted}:${last.id}`
    : `v1:${Buffer.from(JSON.stringify([normalizeUsageTimestamp(last.created_at), last.id])).toString("base64url")}`;
}
