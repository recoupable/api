import { isCID } from "./isCID";
import { isIPFSUrl } from "./isIPFSUrl";

/**
 * Checks if a URL is a normalizeable IPFS URL.
 *
 * @param url - The URL to check.
 * @returns True if the URL is a normalizeable IPFS URL, false otherwise.
 */
export function isNormalizeableIPFSUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;

  // Handle minor formatting noise: whitespace and wrapped quotes
  const cleaned = url.trim().replace(/^["']|["']$/g, "");

  return isIPFSUrl(cleaned) || isCID(cleaned);
}
