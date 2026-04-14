import supabase from "@/lib/supabase/serverClient";
import { SUPABASE_STORAGE_BUCKET } from "@/lib/const";

/**
 * Upload File By Key.
 *
 * @param key - Value for key.
 * @param file - Value for file.
 * @param options - Options for this operation.
 * @param options.contentType - Value for options.contentType.
 * @param options.upsert - Value for options.upsert.
 * @returns - Computed result.
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
