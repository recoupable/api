import supabase from "@/lib/supabase/serverClient";

/** Fail closed unless ingestion has a dedicated private bucket. Never provisions storage at runtime. */
export async function getIngestionBucket(): Promise<string> {
  const name = process.env.INGESTION_STORAGE_BUCKET;
  if (!name || !/^[a-z0-9-]{3,63}$/.test(name)) throw new Error("Ingestion storage unavailable");
  const { data, error } = await supabase.storage.getBucket(name);
  if (error || !data || data.public) throw new Error("Private ingestion storage required");
  return name;
}
