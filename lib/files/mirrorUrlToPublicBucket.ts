import { isSafeHttpUrl } from "@/lib/networking/isSafeHttpUrl";
import { uploadDataToPublicBucket } from "@/lib/files/uploadDataToPublicBucket";

const MAX_MIRROR_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Fetches the image at `imageUrl` and uploads its bytes to the public-uploads
 * Supabase bucket so we hold a durable copy of CDN-served (and potentially
 * rotating / expiring) third-party images.
 *
 * Returns the public CDN URL on success, or `null` if fetch/validation/upload
 * fails — callers should fall back to the original URL in that case, matching
 * the legacy `uploadLinkToArweave` contract.
 *
 * Rejects non-http(s) and private/loopback hosts to avoid SSRF, caps the
 * download at MAX_MIRROR_BYTES so a malicious server cannot exhaust memory,
 * and bounds the fetch with a timeout so a slow server cannot stall callers.
 *
 * @param imageUrl - Remote image URL.
 */
export async function mirrorUrlToPublicBucket(
  imageUrl: string | null | undefined,
): Promise<string | null> {
  if (!imageUrl) return null;
  if (!isSafeHttpUrl(imageUrl)) {
    console.error("[ERROR] mirrorUrlToPublicBucket: rejected unsafe url");
    return null;
  }

  try {
    const res = await fetch(imageUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok || !res.body) return null;

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) return null;

    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength > MAX_MIRROR_BYTES) return null;

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_MIRROR_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
    const fileExtension = extensionFromContentType(contentType);
    const { url } = await uploadDataToPublicBucket({
      data: buffer,
      contentType,
      fileExtension,
    });
    return url;
  } catch (err) {
    console.error("[ERROR] mirrorUrlToPublicBucket:", err);
    return null;
  }
}

function extensionFromContentType(contentType: string): string {
  switch (contentType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    default:
      return ".bin";
  }
}
