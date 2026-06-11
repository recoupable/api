import { start } from "workflow/api";
import { resolveSnapshotAlbums } from "@/lib/research/playcounts/resolveSnapshotAlbums";
import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import { insertPlaycountSnapshot } from "@/lib/supabase/playcount_snapshots/insertPlaycountSnapshot";
import { playcountSnapshotWorkflow } from "@/app/workflows/playcountSnapshotWorkflow";
import { CreateSnapshotBody } from "@/lib/research/playcounts/validateCreateSnapshotRequest";

/** Actor pricing: ~$3 per 1k album URLs. */
const COST_PER_ALBUM_USD = 0.003;
const DEFAULT_MONTHLY_CAP_USD = 25;

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

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthSnapshots = await selectPlaycountSnapshots({
    account: params.accountId,
    createdAfter: monthStart.toISOString(),
  });
  const spentUsd = monthSnapshots.reduce((sum, row) => sum + (row.estimated_cost_usd ?? 0), 0);
  const estimatedCostUsd = Number((albumIds.length * COST_PER_ALBUM_USD).toFixed(4));
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
