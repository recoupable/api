import supabase from "@/lib/supabase/serverClient";
import { PUBLIC_UPLOADS_BUCKET } from "@/lib/supabase/storage/const";

/**
 * Upload an object to the public `public-uploads` bucket.
 *
 * Sibling of `uploadFileByKey`, which targets the private `user-files` bucket
 * and hands back signed urls. Generated media is served straight from the CDN,
 * so it needs the public bucket and a plain built url instead.
 *
 * @param key - Object key inside the bucket.
 * @param file - Bytes to write.
 * @param options - Content type, and whether to overwrite an existing object.
 */
export async function uploadPublicFileByKey(
  key: string,
  file: File | Blob,
  options: { contentType?: string; upsert?: boolean } = {},
): Promise<void> {
  const { error } = await supabase.storage.from(PUBLIC_UPLOADS_BUCKET).upload(key, file, {
    contentType: options.contentType || "application/octet-stream",
    upsert: options.upsert ?? false,
  });

  if (error) {
    throw new Error(`Failed to upload public file: ${error.message}`);
  }
}
