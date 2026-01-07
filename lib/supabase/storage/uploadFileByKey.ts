import supabase from "@/lib/supabase/serverClient";
import { SUPABASE_STORAGE_BUCKET } from "@/lib/consts";

/**
 * Upload file to Supabase storage by key
 */
export async function uploadFileByKey(
  key: string,
  file: File | Blob,
  options: {
    contentType?: string;
    upsert?: boolean;
  } = {}
): Promise<void> {
  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .upload(key, file, {
      contentType: options.contentType || "application/octet-stream",
      upsert: options.upsert ?? false,
    });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

