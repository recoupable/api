import { randomUUID } from "node:crypto";
import { uploadFileByKey } from "@/lib/supabase/storage/uploadFileByKey";
import { createSignedFileUrlByKey } from "@/lib/supabase/storage/createSignedFileUrlByKey";
import type { PackFile } from "./packTypes";
/** Store private media under the billing workspace, never in public generated-file buckets. */
export async function storePackFile(
  ownerId: string,
  bytes: Buffer,
  contentType: string,
): Promise<PackFile & { url: string }> {
  const extension: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/flac": "flac",
    "audio/mp4": "m4a",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "video/mp4": "mp4",
  };
  if (!extension[contentType]) throw new Error("Unsupported pack media type");
  const storage_key = `${ownerId}/release-packs/${randomUUID()}.${extension[contentType]}`;
  await uploadFileByKey(storage_key, new Blob([new Uint8Array(bytes)], { type: contentType }), {
    contentType,
  });
  const url = await createSignedFileUrlByKey({ key: storage_key, expiresInSeconds: 7 * 86400 });
  return { storage_key, content_type: contentType, bytes: bytes.length, url };
}
