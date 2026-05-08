import supabase from "@/lib/supabase/serverClient";
import { SUPABASE_STORAGE_BUCKET } from "@/lib/const";

/**
 * Upload file to Supabase storage by key.
 *
 * @param key - Storage object key (path within the bucket).
 * @param file - File or Blob to upload.
 * @param options - Optional bucket override and standard upload options.
 *   - `bucket` defaults to `SUPABASE_STORAGE_BUCKET` (the private `user-files` bucket).
 *   - `cacheControl` is the seconds value passed to Supabase Storage (e.g. "31536000").
 */
export async function uploadFileByKey(
  key: string,
  file: File | Blob,
  options: {
    bucket?: string;
    contentType?: string;
    cacheControl?: string;
    upsert?: boolean;
  } = {},
): Promise<void> {
  const bucket = options.bucket ?? SUPABASE_STORAGE_BUCKET;
  const { error } = await supabase.storage.from(bucket).upload(key, file, {
    contentType: options.contentType || "application/octet-stream",
    cacheControl: options.cacheControl,
    upsert: options.upsert ?? false,
  });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}
