import supabase from "@/lib/supabase/serverClient";

/**
 * Returns the public CDN URL for an object in a Supabase Storage public bucket.
 *
 * Pure: does not perform an access check, does not contact the network.
 * The bucket must be configured as `public = true` for the URL to actually serve.
 *
 * @param key - Storage object key (path within the bucket).
 * @param bucket - Bucket name. Required so callers don't accidentally hit the
 *   default private `user-files` bucket.
 */
export function getPublicUrlByKey(key: string, bucket: string): string {
  return supabase.storage.from(bucket).getPublicUrl(key).data.publicUrl;
}
