import { FatalError } from "workflow";
import { selectCatalogStreamRun } from "@/lib/supabase/catalog_stream_runs/selectCatalogStreamRun";
import { selectCatalogStreamTracking } from "@/lib/supabase/catalog_stream_tracking/selectCatalogStreamTracking";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";
import { selectCatalogSongs } from "@/lib/supabase/catalog_songs/selectCatalogSongs";
/** Recheck ownership, revision and optional recording membership before each provider request/retry. */
export async function assertCatalogStreamRunActive(runId: string, isrc?: string) {
  const run = await selectCatalogStreamRun(runId);
  const tracking = await selectCatalogStreamTracking(run.catalog_id);
  if (
    !tracking?.enabled ||
    tracking.revision !== run.revision ||
    !["queued", "running"].includes(run.status) ||
    !(await selectAccountCatalog({ accountIds: [tracking.owner_id], catalogId: run.catalog_id }))
  )
    throw new FatalError("Catalog stream run revoked");
  if (isrc && !(await selectCatalogSongs([isrc])).some(row => row.catalog === run.catalog_id))
    throw new FatalError("Recording removed from catalog");
  return run;
}
