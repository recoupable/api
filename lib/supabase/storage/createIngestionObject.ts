import supabase from "@/lib/supabase/serverClient";
import { getIngestionBucket } from "./getIngestionBucket";
import { INGESTION_MAX_ARTIFACT_BYTES } from "@/lib/ingestion/const";

/** Atomic create-only private write; retries cannot replace an accepted artifact. */
export async function createIngestionObject(key: string, bytes: Uint8Array): Promise<boolean> {
  if (bytes.length > INGESTION_MAX_ARTIFACT_BYTES) throw new Error("Ingestion object too large");
  const bucket = await getIngestionBucket();
  const { error } = await supabase.storage.from(bucket).upload(key, Buffer.from(bytes), {
    contentType: "application/octet-stream",
    upsert: false,
    cacheControl: "0",
  });
  if (!error) return true;
  if ("statusCode" in error && String(error.statusCode) === "409") return false;
  console.error("[ingestion] storage write failed", {
    status:
      "statusCode" in error && /^\d{3}$/.test(String(error.statusCode))
        ? String(error.statusCode)
        : "unknown",
  });
  throw new Error("Ingestion storage write failed");
}
