import { isSafeHttpUrl } from "@/lib/networking/isSafeHttpUrl";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

export interface FetchedImage {
  buffer: Buffer;
  contentType: string;
}

/**
 * Fetches a remote image URL and returns its bytes + Content-Type.
 *
 * Rejects non-http(s) and private/loopback hosts to avoid SSRF, requires
 * an `image/*` Content-Type on the response, caps the download at 10 MiB,
 * and bounds the fetch with a 10s timeout so a slow server cannot stall
 * callers. Returns `null` on any failure — callers decide what to do
 * (typically: fall back to the original URL).
 *
 * @param imageUrl - Remote image URL.
 */
export async function fetchRemoteImageBuffer(
  imageUrl: string | null | undefined,
): Promise<FetchedImage | null> {
  if (!imageUrl) return null;
  if (!isSafeHttpUrl(imageUrl)) {
    console.error("[ERROR] fetchRemoteImageBuffer: rejected unsafe url");
    return null;
  }

  try {
    const res = await fetch(imageUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok || !res.body) return null;

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) {
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
    return { buffer, contentType };
  } catch (err) {
    console.error("[ERROR] fetchRemoteImageBuffer:", err);
    return null;
  }
}
