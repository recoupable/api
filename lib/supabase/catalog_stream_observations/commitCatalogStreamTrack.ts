import supabase from "../serverClient";
import type { Json } from "@/types/database.types";
/** Fence revocation and current membership atomically with idempotent receipts/writes. */
export async function commitCatalogStreamTrack(runId: string, isrc: string, result: Json) {
  const { data, error } = await supabase.rpc("commit_catalog_stream_track", {
    p_run_id: runId,
    p_isrc: isrc,
    p_result: result,
  });
  if (error) throw new Error("Unable to commit catalog stream observations");
  return data === true;
}
