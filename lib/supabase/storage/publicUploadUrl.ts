import { PUBLIC_UPLOADS_BUCKET } from "@/lib/supabase/storage/const";

/**
 * Public CDN URL for an object in the `public-uploads` bucket.
 *
 * Built rather than stored: the bucket is public and its URL shape is stable,
 * so persisting a full URL per row would duplicate the host and break every
 * stored row if the project ever moves. Anyone with the URL can read the object;
 * resource-row authorization does not make public bytes private.
 *
 * @param storageKey - Key inside the bucket.
 * @returns The public URL for that object.
 */
export function publicUploadUrl(storageKey: string): string {
  const base = process.env.SUPABASE_URL as string;
  return `${base}/storage/v1/object/public/${PUBLIC_UPLOADS_BUCKET}/${storageKey}`;
}
