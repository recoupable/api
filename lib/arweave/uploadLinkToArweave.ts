import { uploadToArweave } from "./uploadToArweave";
import { isSafeHttpUrl } from "./isSafeHttpUrl";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Fetches the image at `imageUrl` and uploads its bytes to Arweave.
 * Returns the Arweave transaction id (without the `ar://` prefix) on
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
export async function uploadLinkToArweave(
  imageUrl: string | null | undefined,
): Promise<string | null> {
  if (!imageUrl) return null;
  if (!isSafeHttpUrl(imageUrl)) {
    console.error("[ERROR] uploadLinkToArweave: rejected unsafe url");
    return null;
  }
  try {
    const res = await fetch(imageUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok || !res.body) return null;

    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength > MAX_IMAGE_BYTES) return null;

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
    const contentType = res.headers.get("content-type") || "image/png";

    const transaction = await uploadToArweave(buffer, contentType);
    return transaction?.id ?? null;
  } catch (err) {
    console.error("[ERROR] uploadLinkToArweave:", err);
    return null;
  }
}
