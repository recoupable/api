import { randomUUID } from "node:crypto";
import { uploadFileByKey } from "@/lib/supabase/storage/uploadFileByKey";
import { getPublicUrlByKey } from "@/lib/supabase/storage/getPublicUrlByKey";
import { SUPABASE_PUBLIC_UPLOADS_BUCKET } from "@/lib/const";

/**
 * Stores arbitrary data publicly and returns the permanent fetchable URL
 * plus the opaque object id.
 *
 * Provider-agnostic from the caller's perspective: the implementation is
 * currently backed by a Supabase public Storage bucket, but callers should
 * not assume anything about the URL shape or the id format. Phase 2 may
 * route some uploads to a private bucket + signed URL flow without changing
 * this signature.
 *
 * @returns `{ url, id }` where `url` is the permanent public URL and `id`
 *   is the durable identifier that can be persisted on the parent resource.
 */
export async function uploadPublicAsset(input: {
  data: Buffer | Uint8Array | string;
  contentType: string;
}): Promise<{ url: string; id: string }> {
  const { data, contentType } = input;

  const id = randomUUID();

  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data instanceof Buffer ? data : Buffer.from(data)], { type: contentType });

  await uploadFileByKey(id, blob, {
    bucket: SUPABASE_PUBLIC_UPLOADS_BUCKET,
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });

  const url = getPublicUrlByKey(id, SUPABASE_PUBLIC_UPLOADS_BUCKET);
  return { url, id };
}
