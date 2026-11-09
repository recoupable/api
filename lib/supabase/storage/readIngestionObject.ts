import supabase from "@/lib/supabase/serverClient";
import { getIngestionBucket } from "./getIngestionBucket";
import { INGESTION_MAX_ARTIFACT_BYTES } from "@/lib/ingestion/const";

/** Server-only private artifact read. Only an actual not-found response becomes null. */
export async function readIngestionObject(key: string): Promise<Uint8Array | null> {
  const bucket = await getIngestionBucket();
  const { data, error } = await supabase.storage.from(bucket).download(key);
  if (error) {
    if ("statusCode" in error && String(error.statusCode) === "404") return null;
    throw new Error("Ingestion storage read failed");
  }
  if (!data || data.size > INGESTION_MAX_ARTIFACT_BYTES)
    throw new Error("Ingestion object invalid");
  return new Uint8Array(await data.arrayBuffer());
}
