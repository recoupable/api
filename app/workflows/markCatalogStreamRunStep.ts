import {
  updateCatalogStreamRun,
  type CatalogStreamRunError,
} from "@/lib/supabase/catalog_stream_runs/updateCatalogStreamRun";
import type { CatalogStreamRun } from "@/types/catalogStreams";
/** Persist workflow completion, including incomplete and revoked runs. */
export async function markCatalogStreamRunStep(
  runId: string,
  status: CatalogStreamRun["status"],
  errorCode: CatalogStreamRunError | null = null,
) {
  "use step";
  await updateCatalogStreamRun(runId, status, errorCode);
}
