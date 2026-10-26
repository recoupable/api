import { uploadPublicAsset } from "./uploadPublicAsset";
import { validatePublicUploadBytes } from "./validatePublicUploadBytes";
import { isSafeHttpUrl } from "@/lib/arweave/isSafeHttpUrl";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Fetches the image at `imageUrl` and stores its bytes in public media storage.
 * Returns the public HTTPS URL on
 * success, or `null` if fetch / upload fails — callers should fall
 * back to the original URL in that case.
 *
 * Rejects non-http(s) URLs and private/loopback hosts to avoid SSRF,
 * caps the download at MAX_IMAGE_BYTES so a malicious server cannot
 * exhaust memory, and bounds the fetch with a timeout so a slow server
 * cannot stall the webhook.
 *
 * @param imageUrl - Remote image URL.
 */
export async function mirrorPublicImage(
  imageUrl: string | null | undefined,
): Promise<string | null> {
  if (!imageUrl) return null;
  if (!isSafeHttpUrl(imageUrl)) {
    console.error("[ERROR] mirrorPublicImage: rejected unsafe url");
    return null;
  }
  try {
    const res = await fetch(imageUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok || !res.body) {
      await res.body?.cancel();
      return null;
    }

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(contentType)) {
      await res.body.cancel();
      return null;
    }

    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength > MAX_IMAGE_BYTES) {
      await res.body.cancel();
      return null;
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)));

    if (!validatePublicUploadBytes(buffer, contentType)) return null;
    const { url } = await uploadPublicAsset({ data: buffer, contentType });
    return url;
  } catch (err) {
    console.error("[ERROR] mirrorPublicImage:", err);
    return null;
  }
}
