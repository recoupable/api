import { uploadPublicFileByKey } from "@/lib/supabase/storage/uploadPublicFileByKey";

export type StoredMusicAudio = {
  storageKey: string;
  mimeType: string;
  fileSizeBytes: number;
};

/**
 * Mirror a finished generation's audio into the public-uploads bucket.
 *
 * fal's CDN urls are third-party and expire, and the stated direction of
 * travel for this bucket is away from external urls, so the song we serve is
 * always our own object. The fal url stays on the row as provenance.
 *
 * @param generationId - Used as the object key, so the key is unique per row
 *   and a retry of this step overwrites rather than duplicating.
 * @param audioUrl - fal's audio url.
 * @param contentType - Media type reported by fal, if any.
 * @returns The storage key and the size actually written.
 */
export async function storeMusicAudioStep(
  generationId: string,
  audioUrl: string,
  contentType: string | null,
): Promise<StoredMusicAudio> {
  "use step";
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to download generated audio: ${response.status}`);
  }

  const mimeType = contentType || response.headers.get("content-type") || "audio/wav";
  const bytes = await response.arrayBuffer();
  const extension = mimeType.includes("mpeg") ? "mp3" : "wav";
  const storageKey = `music/${generationId}.${extension}`;

  await uploadPublicFileByKey(storageKey, new Blob([bytes], { type: mimeType }), {
    contentType: mimeType,
    // Retries of this step must be idempotent: the same key rewritten, never a
    // second object orphaning the first.
    upsert: true,
  });

  return { storageKey, mimeType, fileSizeBytes: bytes.byteLength };
}
