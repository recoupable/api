import { start } from "workflow/api";
import { claimCatalogStreamRun } from "@/lib/supabase/catalog_stream_runs/claimCatalogStreamRun";
import { updateCatalogStreamRun } from "@/lib/supabase/catalog_stream_runs/updateCatalogStreamRun";
import { catalogStreamsWorkflow } from "@/app/workflows/catalogStreamsWorkflow";
/** One daily run per catalog revision. No new claim means no provider traffic. */
export async function startCatalogStreamRun(catalogId: string) {
  if (
    !process.env.LUMINATE_API_KEY ||
    !process.env.LUMINATE_USERNAME ||
    !process.env.LUMINATE_PASSWORD
  )
    throw new Error("Luminate is not configured");
  const run = await claimCatalogStreamRun(catalogId, new Date().toISOString().slice(0, 10));
  if (!run) return { state: "already_claimed_or_disabled" as const, run_id: null };
  try {
    const workflow = await start(catalogStreamsWorkflow, [run.id]);
    return { state: "started" as const, run_id: run.id, workflow_run_id: workflow.runId };
  } catch {
    await updateCatalogStreamRun(run.id, "failed", "workflow_start_failed");
    throw new Error("Unable to start catalog stream collection");
  }
}
