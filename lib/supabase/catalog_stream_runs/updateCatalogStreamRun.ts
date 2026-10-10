import supabase from "../serverClient";
import type { CatalogStreamRun } from "@/types/catalogStreams";
export type CatalogStreamRunError =
  | "workflow_start_failed"
  | "provider_authentication_failed"
  | "collection_failed_or_revoked";
/** Store bounded public status codes; never provider bodies or credentials. */
export async function updateCatalogStreamRun(
  id: string,
  status: CatalogStreamRun["status"],
  errorCode: CatalogStreamRunError | null = null,
) {
  if (
    errorCode &&
    ![
      "workflow_start_failed",
      "provider_authentication_failed",
      "collection_failed_or_revoked",
    ].includes(errorCode)
  )
    throw new Error("Invalid collection error code");
  const { error } = await supabase
    .from("catalog_stream_runs")
    .update({
      status,
      error: errorCode,
      finished_at: status === "running" ? null : new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error("Unable to update catalog stream run");
}
