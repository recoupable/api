import supabase from "../serverClient";
import type { CatalogStreamRun } from "@/types/catalogStreams";
/** Store bounded public status codes; never provider bodies or credentials. */
export async function updateCatalogStreamRun(
  id: string,
  status: CatalogStreamRun["status"],
  errorCode: string | null = null,
) {
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
