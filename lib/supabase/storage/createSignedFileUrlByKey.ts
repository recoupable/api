import supabase from "@/lib/supabase/serverClient";
import { SUPABASE_STORAGE_BUCKET } from "@/lib/const";

/**
 * Creates a signed URL for a file in Supabase storage.
 *
 * @param root0 - The signed URL parameters
 * @param root0.key - The storage key (path) of the file to sign
 * @param root0.expiresInSeconds - Number of seconds until the signed URL expires (default: 7 days)
 * @returns The signed URL string for accessing the file
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
