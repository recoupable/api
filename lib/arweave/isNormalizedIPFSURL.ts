/**
 * Checks if a URL is a normalized IPFS URL.
 *
 * @param url - The URL to check.
 * @returns True if the URL is a normalized IPFS URL, false otherwise.
 */
export function isNormalizedIPFSURL(url: string | null | undefined): boolean {
  return url && typeof url === "string" ? url.startsWith("ipfs://") : false;
}
