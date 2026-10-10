import { commitCatalogStreamTrack } from "@/lib/supabase/catalog_stream_observations/commitCatalogStreamTrack";
import type { Json } from "@/types/database.types";
/** Commit receipts and observations atomically with subscription and membership fencing. */
export async function writeCatalogStreamTrackStep(runId: string, isrc: string, result: Json) {
  "use step";
  return commitCatalogStreamTrack(runId, isrc, result);
}
