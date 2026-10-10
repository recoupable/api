import { FatalError } from "workflow";
import { assertCatalogStreamRunActive } from "@/lib/catalog/assertCatalogStreamRunActive";
import { selectCatalogRecordingPage } from "@/lib/supabase/catalog_songs/selectCatalogRecordingPage";
import { updateCatalogStreamRun } from "@/lib/supabase/catalog_stream_runs/updateCatalogStreamRun";
/** Freeze this run's current membership; preflight catalog size before any provider traffic. */
export async function prepareCatalogStreamRunStep(runId: string) {
  "use step";
  const run = await assertCatalogStreamRunActive(runId);
  const page = await selectCatalogRecordingPage({ catalogId: run.catalog_id, page: 1, limit: 250 });
  if (page.total_count > 250)
    throw new FatalError("Catalog exceeds MVP collection limit of 250 recordings");
  await updateCatalogStreamRun(runId, "running");
  return page;
}
