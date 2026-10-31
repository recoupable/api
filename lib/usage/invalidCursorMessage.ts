import type { UsageSort } from "@/lib/usage/usageSort";

/**
 * The 400 message for a `cursor` that does not fit its sort.
 *
 * @param sort - The requested sort.
 * @returns The `{ error }` text.
 */
export function invalidCursorMessage(sort: UsageSort): string {
  return sort === "cost"
    ? "cursor: expected <credits_deducted>:<id> for sort=cost"
    : "cursor: expected a next_cursor token or legacy ISO datetime for sort=created_at";
}
