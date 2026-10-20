import { randomUUID } from "node:crypto";
import { uploadPackAssetSchema } from "./releasePackSchema";
import { resolvePackMediaType } from "./resolvePackMediaType";
import { storePackFile } from "./storePackFile";
import { fetchPackMedia } from "./fetchPackMedia";
import { createPackSignedUpload } from "@/lib/supabase/storage/createPackSignedUpload";
import { createSignedFileUrlByKey } from "@/lib/supabase/storage/createSignedFileUrlByKey";
import type { PackActor } from "./packTypes";
/** Direct-to-private-storage upload bypasses host request size limits; finalization verifies actual bytes. */
export async function uploadPackAsset(actor: PackActor, raw: unknown) {
  const input = uploadPackAssetSchema.parse(raw);
  const owner = actor.organizationId ?? actor.accountId;
  if (input.mode === "signed_url") {
    if (input.base64 || input.source_url || input.storage_key || input.file || !input.content_type)
      throw new Error("A signed upload request cannot include file content");
    const extensions: Record<string, string> = {
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
      "audio/flac": "flac",
      "audio/mp4": "m4a",
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    };
    return {
      ...(await createPackSignedUpload(
        `${owner}/release-packs/uploads/${randomUUID()}.${extensions[input.content_type]}`,
      )),
      maximum_bytes: 50 * 1024 * 1024,
      next_action:
        "Transfer only the selected file to signed_upload_url with its content-type, then call finalize. This capability uploads one private object and is not a Recoup login credential.",
    };
  }
  if (input.mode === "finalize") {
    if (
      input.base64 ||
      input.source_url ||
      input.file ||
      !input.storage_key ||
      !input.storage_key.startsWith(`${owner}/release-packs/uploads/`) ||
      !/\/uploads\/[a-f0-9-]{36}\.[a-z0-9]+$/.test(input.storage_key)
    )
      throw new Error("Private upload ownership mismatch");
    const url = await createSignedFileUrlByKey({
      key: input.storage_key,
      expiresInSeconds: 7 * 86400,
    });
    const media = await fetchPackMedia(url);
    const contentType = resolvePackMediaType(media.bytes, input.content_type);
    return {
      storage_key: input.storage_key,
      url,
      content_type: contentType,
      bytes: media.bytes.length,
      expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    };
  }
  if (
    Number(!!input.base64) + Number(!!input.source_url) + Number(!!input.file) !== 1 ||
    input.storage_key
  )
    throw new Error(
      "Supply exactly one selected file, base64 file (up to 3 MiB), or HTTPS source_url (up to 50 MiB)",
    );
  let bytes: Buffer;
  if (input.base64) {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.base64))
      throw new Error("Invalid base64 media");
    bytes = Buffer.from(input.base64, "base64");
  } else bytes = (await fetchPackMedia(input.file?.download_url ?? input.source_url!)).bytes;
  const contentType = resolvePackMediaType(bytes, input.content_type ?? input.file?.mime_type);
  const file = await storePackFile(owner, bytes, contentType);
  return {
    ...file,
    content_type: contentType,
    expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
  };
}
