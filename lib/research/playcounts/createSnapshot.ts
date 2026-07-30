import { start } from "workflow/api";
import { resolveSnapshotAlbums } from "@/lib/research/playcounts/resolveSnapshotAlbums";
import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import { insertPlaycountSnapshot } from "@/lib/supabase/playcount_snapshots/insertPlaycountSnapshot";
import { playcountSnapshotWorkflow } from "@/app/workflows/playcountSnapshotWorkflow";
import { findReusableSnapshot } from "@/lib/research/playcounts/findReusableSnapshot";
import { buildReusedSnapshotResult } from "@/lib/research/playcounts/buildReusedSnapshotResult";
import { pickCanonicalSnapshot } from "@/lib/research/playcounts/pickCanonicalSnapshot";
import { sameScope } from "@/lib/research/playcounts/sameScope";
import { deletePlaycountSnapshot } from "@/lib/supabase/playcount_snapshots/deletePlaycountSnapshot";
import { getMonthlySpendUsd } from "@/lib/research/playcounts/getMonthlySpendUsd";
import { CreateSnapshotBody } from "@/lib/research/playcounts/validateCreateSnapshotRequest";

/** Actor pricing: ~$3 per 1k album URLs. */
const COST_PER_ALBUM_USD = 0.003;
const DEFAULT_MONTHLY_CAP_USD = 25;
/**
 * Play counts do not move meaningfully inside an hour, so an identical capture
 * requested within this window reuses the earlier one rather than re-scraping
 * (chat#1912 row 4).
 */
const REUSE_WINDOW_MINUTES = 60;

export type CreateSnapshotResult = { data: unknown } | { error: string; status: number };

/**
 * Create a snapshot job: resolve the input to album ids, enforce the per-org
 * monthly cost cap, persist the job (mints `snapshot_id`), and start the
 * capture workflow. Returns the 202 payload with the cost estimate — the
 * estimate is computed before any scraper spend.
 *
 * @param params.accountId - The authenticated account (cap scope)
 * @param params.body - Validated snapshot request body
 */
export async function createSnapshot(params: {
  accountId: string;
  body: CreateSnapshotBody;
}): Promise<CreateSnapshotResult> {
  const albumIds = await resolveSnapshotAlbums(params.body);
  if (albumIds.length === 0) {
    return {
      error: "No albums resolvable from the given input — no identifier mappings exist yet",
      status: 400,
    };
  }

  const now = new Date();
  const monthStart = new Date(now);
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const reuseCutoff = new Date(now.getTime() - REUSE_WINDOW_MINUTES * 60 * 1000);

  // One query serves both needs, so the lower bound is whichever reaches
  // further back. Without this, a request in the first hour of a UTC month
  // could not see the previous month's captures and re-scraped them.
  const lookbackStart = reuseCutoff < monthStart ? reuseCutoff : monthStart;
  const snapshots = await selectPlaycountSnapshots({
    account: params.accountId,
    createdAfter: lookbackStart.toISOString(),
  });

  const spentUsd = getMonthlySpendUsd(snapshots, monthStart);
  const estimatedCostUsd = Number((albumIds.length * COST_PER_ALBUM_USD).toFixed(4));

  // Hand back an identical recent capture rather than scraping the same albums
  // twice.
  const reusable = findReusableSnapshot({
    snapshots,
    albumIds,
    platforms: params.body.platforms,
    schedule: params.body.schedule,
    windowMinutes: REUSE_WINDOW_MINUTES,
    now,
  });
  if (reusable) return buildReusedSnapshotResult(reusable);
  const capUsd = Number(process.env.SNAPSHOT_MONTHLY_CAP_USD) || DEFAULT_MONTHLY_CAP_USD;
  if (spentUsd + estimatedCostUsd > capUsd) {
    return { error: "Per-organization monthly snapshot cap reached", status: 429 };
  }

  const row = await insertPlaycountSnapshot({
    account: params.accountId,
    catalog: params.body.catalog_id ?? null,
    album_ids: albumIds,
    isrcs: params.body.isrcs ?? null,
    platforms: params.body.platforms,
    schedule: params.body.schedule,
    state: "queued",
    album_count: albumIds.length,
    estimated_cost_usd: estimatedCostUsd,
  });

  // The insert is a claim, not yet a scrape. Two simultaneous identical
  // requests both get here before either can see the other, so re-read and
  // let the earliest claim win — the loser withdraws its row and hands back
  // the winner's rather than starting a second capture (chat#1912 row 7).
  const claims = await selectPlaycountSnapshots({
    account: params.accountId,
    createdAfter: reuseCutoff.toISOString(),
  });
  const canonical = pickCanonicalSnapshot(
    claims.filter(
      candidate =>
        candidate.id === row.id ||
        (sameScope(candidate, albumIds, params.body.platforms, params.body.schedule) &&
          candidate.state === "queued"),
    ),
  );
  if (canonical && canonical.id !== row.id) {
    await deletePlaycountSnapshot(row.id);
    return buildReusedSnapshotResult(canonical);
  }

  await start(playcountSnapshotWorkflow, [row.id]);

  return {
    data: {
      status: "success",
      snapshot_id: row.id,
      state: "queued",
      album_count: albumIds.length,
      estimated_cost_usd: estimatedCostUsd,
    },
  };
}
