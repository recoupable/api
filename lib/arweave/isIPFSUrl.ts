import { isNormalizedIPFSURL } from "./isNormalizedIPFSURL";
import { isGatewayIPFSUrl } from "./isGatewayIPFSUrl";

/**
 * Checks if a URL is a IPFS URL.
 *
 * @param url - The URL to check.
 * @returns True if the URL is a IPFS URL, false otherwise.
 */
export function isIPFSUrl(url: string | null | undefined): boolean {
  return url ? isNormalizedIPFSURL(url) || isGatewayIPFSUrl(url) : false;
}
