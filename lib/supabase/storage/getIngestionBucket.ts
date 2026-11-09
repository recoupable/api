import supabase from "@/lib/supabase/serverClient";
import { INGESTION_MAX_ARTIFACT_BYTES } from "@/lib/ingestion/const";

/** Fail closed unless ingestion has a dedicated private bucket. Never provisions storage at runtime. */
export async function getIngestionBucket(): Promise<string> {
  const name = process.env.INGESTION_STORAGE_BUCKET;
  if (!name || !/^[a-z0-9-]{3,63}$/.test(name)) throw new Error("Ingestion storage unavailable");
  const { data, error } = await supabase.storage.getBucket(name);
  if (error || !data) {
    console.error("[ingestion] bucket lookup failed");
    throw new Error("Ingestion storage unavailable");
  }
  if (data.public) throw new Error("Private ingestion storage required");
  if (data.file_size_limit !== INGESTION_MAX_ARTIFACT_BYTES)
    throw new Error("Ingestion bucket size limit required");
  return name;
}
