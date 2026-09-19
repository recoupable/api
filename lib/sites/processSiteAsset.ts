import sharp from "sharp";
import { z } from "zod";
import { authorizeSiteWorkspace } from "./authorizeSiteWorkspace";
import { uploadSiteAsset } from "@/lib/supabase/storage/uploadSiteAsset";
import { SiteError } from "./SiteError";
/** Validate and sanitize uploads before storing workspace-owned assets. */
export async function processSiteAsset(accountId: string, organizationId: unknown, file: unknown) {
  const org = z.string().uuid().nullable().optional().parse(organizationId);
  const ownerId = await authorizeSiteWorkspace(accountId, org);
  if (!(file instanceof File) || file.size === 0 || file.size > 4 * 1024 * 1024)
    throw new SiteError(400, "Choose an image or audio file under 4 MB");
  let bytes: Buffer = Buffer.from(await file.arrayBuffer());
  let type: "image" | "audio", contentType: string, extension: string;
  if (["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    bytes = await sharp(bytes, { limitInputPixels: 40000000 })
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 88 })
      .toBuffer();
    type = "image";
    contentType = "image/webp";
    extension = "webp";
  } else if (
    (file.type === "audio/mpeg" &&
      (bytes.subarray(0, 3).toString() === "ID3" ||
        (bytes[0] === 255 && (bytes[1] & 224) === 224))) ||
    (["audio/wav", "audio/x-wav"].includes(file.type) &&
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WAVE")
  ) {
    type = "audio";
    extension = file.type === "audio/mpeg" ? "mp3" : "wav";
    contentType = extension === "mp3" ? "audio/mpeg" : "audio/wav";
  } else throw new SiteError(400, "Use JPG, PNG, WebP, MP3, or WAV");
  const url = await uploadSiteAsset(ownerId, bytes, contentType, extension);

  return { asset: { url, type, name: file.name.slice(0, 200) } };
}
