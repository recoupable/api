import type { UsageSort } from "@/lib/usage/usageSort";

/**
 * `next_cursor` for the last item of a page: its `created_at` when sorted by
 * time, `<credits_deducted>:<id>` when sorted by cost. Clients pass it back
 * unchanged.
 *
 * @param sort - The page's sort.
 * @param last - The last item on the page.
 * @returns The cursor string.
 */
export function encodeUsageCursor(
  sort: UsageSort,
  last: { id: string; created_at: string; credits_deducted: number },
): string {
  return sort === "cost" ? `${last.credits_deducted}:${last.id}` : last.created_at;
}
