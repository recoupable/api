import supabase from "@/lib/supabase/serverClient";
import { SUPABASE_STORAGE_BUCKET } from "@/lib/const";

/**
 * Upload file to Supabase storage by key.
 *
 * @param key - The storage key (path) where the file will be stored
 * @param file - The file or blob data to upload
 * @param options - Optional upload configuration
 * @param options.contentType - MIME type of the file (defaults to application/octet-stream)
 * @param options.upsert - Whether to overwrite an existing file at the same key (defaults to false)
 */
export async function uploadFileByKey(
  key: string,
  file: File | Blob,
  options: {
    contentType?: string;
    upsert?: boolean;
  } = {},
): Promise<void> {
  const { error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(key, file, {
    contentType: options.contentType || "application/octet-stream",
    upsert: options.upsert ?? false,
  });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}
