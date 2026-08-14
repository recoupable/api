import type { Tables } from "@/types/database.types";
import { sameScope } from "./sameScope";
import { isReusableSnapshotState } from "./isReusableSnapshotState";

/**
 * Finds a recent capture of exactly the same scope that a new request can reuse
 * instead of re-scraping.
 *
 * One pass through onboarding measured the same albums twice — the seeding
 * valuation, then the first-task pre-run about three minutes later — billing
 * the scraper twice for an identical capture and leaving a second, catalog-less
 * snapshot behind (chat#1912 row 4). Play counts do not move meaningfully in
 * minutes, so within a short window the earlier capture is the correct answer.
 *
 * Scope equality is strict: same album set (order-insensitive), same platforms,
 * same schedule. Anything else is a different question and gets a fresh capture.
 */
export function findReusableSnapshot({
  snapshots,
  albumIds,
  platforms,
  schedule,
  windowMinutes,
  now,
}: {
  snapshots: Tables<"playcount_snapshots">[];
  albumIds: string[];
  platforms: string[];
  schedule: string;
  windowMinutes: number;
  now: Date;
}): Tables<"playcount_snapshots"> | null {
  const cutoff = now.getTime() - windowMinutes * 60 * 1000;

  const eligible = snapshots.filter(row => {
    if (!isReusableSnapshotState(row.state)) return false;
    if (!row.created_at || new Date(row.created_at).getTime() < cutoff) return false;
    return sameScope(row, albumIds, platforms, schedule);
  });

  if (eligible.length === 0) return null;

  return eligible.reduce((newest, row) =>
    new Date(row.created_at!).getTime() > new Date(newest.created_at!).getTime() ? row : newest,
  );
}
