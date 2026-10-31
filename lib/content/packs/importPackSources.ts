import { createHash } from "node:crypto";
import sharp from "sharp";
import { fetchPackMedia } from "./fetchPackMedia";
import { validatePackMediaBytes } from "./validatePackMediaBytes";
import { storePackFile } from "./storePackFile";
import type { ReleasePackBrief } from "./releasePackSchema";
import type { PackFile } from "./packTypes";
export type PackSources = {
  audio: PackFile & { sha256: string };
  references: (PackFile & { sha256: string })[];
};
/** Snapshot actual bytes before quote approval so a changed URL cannot silently change the music. */
export async function importPackSources(
  owner: string,
  brief: ReleasePackBrief,
): Promise<PackSources> {
  const take = async (url: string, kind: "audio" | "image") => {
    const media = await fetchPackMedia(url);
    const checked = validatePackMediaBytes(media.bytes, media.contentType);
    if (!checked.contentType.startsWith(`${kind}/`)) throw new Error(`Expected ${kind} media`);
    if (kind === "image") {
      const metadata = await sharp(media.bytes, { limitInputPixels: 40_000_000 }).metadata();
      if (!metadata.width || !metadata.height) throw new Error("Reference image cannot be decoded");
    }
    const file = await storePackFile(owner, media.bytes, checked.contentType);
    return {
      storage_key: file.storage_key,
      content_type: file.content_type,
      bytes: file.bytes,
      sha256: createHash("sha256").update(media.bytes).digest("hex"),
    };
  };
  const audio = await take(brief.audio_url!, "audio");
  const references = [];
  for (const url of brief.reference_image_urls) references.push(await take(url, "image"));
  return { audio, references };
}
