import { start } from "workflow/api";
import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import { insertPlaycountSnapshot } from "@/lib/supabase/playcount_snapshots/insertPlaycountSnapshot";
import { playcountSnapshotWorkflow } from "@/app/workflows/playcountSnapshotWorkflow";

const DUE_AFTER_DAYS = 30;

/**
 * Re-run due monthly snapshot series. A series is one (account, album set);
 * its latest run being older than 30 days makes it due — a fresh job row is
 * inserted (same inputs, new snapshot_id) and the capture workflow started.
 *
 * @returns Number of snapshot jobs started
 */
export async function startDueMonthlySnapshots(): Promise<number> {
  const monthly = await selectPlaycountSnapshots({ schedule: "monthly" });

  const latestBySeries = new Map<string, (typeof monthly)[number]>();
  for (const row of monthly) {
    const key = `${row.account}:${[...(row.album_ids ?? [])].sort().join(",")}`;
    const existing = latestBySeries.get(key);
    if (!existing || (row.created_at ?? "") > (existing.created_at ?? "")) {
      latestBySeries.set(key, row);
    }
  }

  const dueBefore = Date.now() - DUE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  let started = 0;
  for (const last of latestBySeries.values()) {
    if (new Date(last.created_at ?? 0).getTime() > dueBefore) continue;
    const row = await insertPlaycountSnapshot({
      account: last.account,
      catalog: last.catalog,
      album_ids: last.album_ids,
      isrcs: last.isrcs,
      platforms: last.platforms,
      schedule: "monthly",
      state: "queued",
      album_count: last.album_count,
      estimated_cost_usd: last.estimated_cost_usd,
    });
    await start(playcountSnapshotWorkflow, [row.id]);
    started += 1;
  }
  return started;
}
