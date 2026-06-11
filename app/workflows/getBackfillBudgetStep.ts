import { selectSongstatsQuotaSpent } from "@/lib/supabase/songstats_quota_ledger/selectSongstatsQuotaSpent";

const DEFAULT_QUOTA_LIMIT = 1000;
const DEFAULT_QUOTA_RESERVE = 100;
const WINDOW_DAYS = 30;

/**
 * Remaining Songstats budget for this run: plan limit minus a reserve (kept
 * for request-path fallbacks and manual research) minus hits spent in the
 * rolling 30-day window. Never negative.
 *
 * @returns Hits the backfill worker may spend now
 */
export async function getBackfillBudgetStep(): Promise<number> {
  "use step";
  const limit = Number(process.env.SONGSTATS_QUOTA_LIMIT) || DEFAULT_QUOTA_LIMIT;
  const reserve = Number(process.env.SONGSTATS_QUOTA_RESERVE) || DEFAULT_QUOTA_RESERVE;
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const spent = await selectSongstatsQuotaSpent(since);
  return Math.max(0, limit - reserve - spent);
}
