import supabase from "@/lib/supabase/serverClient";
import { SUPABASE_STORAGE_BUCKET } from "@/lib/const";

/**
 * Creates a signed URL for a file in Supabase storage.
 *
 * @param root0
 * @param root0.key
 * @param root0.expiresInSeconds
 */
export async function createSignedFileUrlByKey({
  key,
  expiresInSeconds = 60 * 60 * 24 * 7,
}: {
  key: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const { data, error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .createSignedUrl(key, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message ?? "unknown error"}`);
  }

  return data.signedUrl;
}
