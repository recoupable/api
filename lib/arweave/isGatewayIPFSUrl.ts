import { isNormalizedIPFSURL } from "./isNormalizedIPFSURL";

/**
 * Checks if a URL is a gateway IPFS URL.
 *
 * @param url - The URL to check.
 * @returns True if the URL is a gateway IPFS URL, false otherwise.
 */
export function isGatewayIPFSUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;

  try {
    const trimmed = url.trim().replace(/^["']|["']$/g, "");
    const parsed = new URL(trimmed);
    return !isNormalizedIPFSURL(url) && parsed.pathname.startsWith("/ipfs/");
  } catch {
    return false;
  }
}
