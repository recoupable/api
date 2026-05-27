import type { Tables } from "@/types/database.types";

export interface RollupAggregateRow {
  account_id: string;
  total_credits_deducted_cents: number;
  event_count: number;
}

/**
 * Aggregates raw `usage_events` rows by `account_id`, summing
 * `credits_deducted_cents` and counting rows. Sorts DESC by total credits
 * with `account_id` ASC as a deterministic tiebreaker so equal-total
 * accounts don't shuffle across pages.
 *
 * @param events - Raw usage_events rows in the period.
 * @returns Aggregated rows sorted by total credits DESC, account_id ASC.
 */
export function aggregateRollupByAccount(events: Tables<"usage_events">[]): RollupAggregateRow[] {
  const byAccount = new Map<string, { total: number; count: number }>();
  for (const event of events) {
    const existing = byAccount.get(event.account_id) ?? { total: 0, count: 0 };
    byAccount.set(event.account_id, {
      total: existing.total + (event.credits_deducted_cents ?? 0),
      count: existing.count + 1,
    });
  }

  return Array.from(byAccount.entries())
    .map(([account_id, v]) => ({
      account_id,
      total_credits_deducted_cents: v.total,
      event_count: v.count,
    }))
    .sort((a, b) => {
      const diff = b.total_credits_deducted_cents - a.total_credits_deducted_cents;
      return diff !== 0 ? diff : a.account_id.localeCompare(b.account_id);
    });
}
