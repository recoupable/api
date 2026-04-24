import { uploadToArweave } from "./uploadToArweave";

/**
 * Fetches the image at `imageUrl` and uploads its bytes to Arweave.
 * Returns the Arweave transaction id (without the `ar://` prefix) on
 * success, or `null` if fetch / upload fails — callers should fall
 * back to the original URL in that case.
 *
 * @param imageUrl - Remote image URL.
 */
export async function uploadLinkToArweave(
  imageUrl: string | null | undefined,
): Promise<string | null> {
  if (!imageUrl) return null;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/png";

    const transaction = await uploadToArweave(buffer, contentType);
    return transaction?.id ?? null;
  } catch (err) {
    console.error("[ERROR] uploadLinkToArweave:", err);
    return null;
  }
}
