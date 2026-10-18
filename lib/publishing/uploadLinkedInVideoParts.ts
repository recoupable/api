export type LinkedInUploadInstruction = { uploadUrl: string; firstByte: number; lastByte: number };

/**
 * PUT each byte range of the video to LinkedIn's pre-signed part URLs.
 *
 * @param video - The whole video.
 * @param parts - Upload instructions from initializeUpload.
 * @returns The part ETags, in order, for finalizeUpload.
 */
export async function uploadLinkedInVideoParts(
  video: ArrayBuffer,
  parts: LinkedInUploadInstruction[],
): Promise<string[]> {
  const etags: string[] = [];
  for (const part of parts) {
    const response = await fetch(part.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: video.slice(part.firstByte, part.lastByte + 1),
    });
    if (!response.ok) throw new Error(`LinkedIn video part upload returned ${response.status}`);
    etags.push(response.headers.get("etag") ?? "");
  }
  return etags;
}
