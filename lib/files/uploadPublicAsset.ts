import { randomUUID } from "node:crypto";
import { uploadPublicFileByKey } from "@/lib/supabase/storage/uploadPublicFileByKey";
import { publicUploadUrl } from "@/lib/supabase/storage/publicUploadUrl";

/** Store already-public media. Private Files/audio must keep their private storage path. */
export async function uploadPublicAsset(input: {
  data: Buffer | string;
  contentType: string;
  /** Validated authentication only; omit for system-generated mirrors. */
  uploaderAccountId?: string;
}): Promise<{ url: string; storageKey: string }> {
  const { data, contentType, uploaderAccountId } = input;
  const storageKey = `${uploaderAccountId ?? "system"}/${randomUUID()}`;
  const blob = new Blob([typeof data === "string" ? data : new Uint8Array(data)], {
    type: contentType,
  });
  await uploadPublicFileByKey(storageKey, blob, {
    contentType,
    upsert: false,
    ...(uploaderAccountId ? { metadata: { uploaded_by: uploaderAccountId } } : {}),
  });
  return { url: publicUploadUrl(storageKey), storageKey };
}
