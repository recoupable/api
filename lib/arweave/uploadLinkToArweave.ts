import { uploadToArweave } from "./uploadToArweave";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function isSafeHttpUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.hostname.toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (
    /^(10\.|127\.|0\.|169\.254\.|192\.168\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd")
  ) {
    return false;
  }
  return true;
}

/**
 * Fetches the image at `imageUrl` and uploads its bytes to Arweave.
 * Returns the Arweave transaction id (without the `ar://` prefix) on
 * success, or `null` if fetch / upload fails — callers should fall
 * back to the original URL in that case.
 *
 * Rejects non-http(s) URLs and private/loopback hosts to avoid SSRF,
 * and caps the download at MAX_IMAGE_BYTES so a malicious server
 * cannot exhaust memory.
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
    const res = await fetch(imageUrl, { redirect: "error" });
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
