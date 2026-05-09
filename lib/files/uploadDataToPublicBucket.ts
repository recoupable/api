import { randomUUID } from "node:crypto";
import { uploadFileByKey } from "@/lib/supabase/storage/uploadFileByKey";
import { getPublicUrlByKey } from "@/lib/supabase/storage/getPublicUrlByKey";
import { SUPABASE_PUBLIC_UPLOADS_BUCKET } from "@/lib/const";

/**
 * Uploads arbitrary data to the public-uploads Supabase bucket and returns
 * the public CDN URL. Storage keys are flat opaque UUIDs at the bucket root.
 *
 * Used by every server-side caller that previously wrote to Arweave.
 *
 * @returns `{ url, key }` where `url` is the public CDN URL and `key` is the
 *   UUID storage object key.
 */
export async function uploadDataToPublicBucket(input: {
  data: Buffer | Uint8Array | string;
  contentType: string;
}): Promise<{ url: string; key: string }> {
  const { data, contentType } = input;

  const key = randomUUID();

  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data instanceof Buffer ? data : Buffer.from(data)], { type: contentType });

  await uploadFileByKey(key, blob, {
    bucket: SUPABASE_PUBLIC_UPLOADS_BUCKET,
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });

  const url = getPublicUrlByKey(key, SUPABASE_PUBLIC_UPLOADS_BUCKET);
  return { url, key };
}
