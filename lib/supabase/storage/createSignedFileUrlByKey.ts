import supabase from "@/lib/supabase/serverClient";
import { SUPABASE_STORAGE_BUCKET } from "@/lib/const";

/**
 * Create Signed File Url By Key.
 *
 * @param root0 - Parameter.
 * @param root0.key - Parameter.
 * @param root0.expiresInSeconds - Parameter.
 * @returns - Result.
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
