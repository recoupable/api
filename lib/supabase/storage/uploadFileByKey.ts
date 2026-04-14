import supabase from "@/lib/supabase/serverClient";
import { SUPABASE_STORAGE_BUCKET } from "@/lib/const";

/**
 * Upload File By Key.
 *
 * @param key - Parameter.
 * @param file - Parameter.
 * @param options - Parameter.
 * @param options.contentType - Parameter.
 * @param options.upsert - Parameter.
 * @returns - Result.
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
