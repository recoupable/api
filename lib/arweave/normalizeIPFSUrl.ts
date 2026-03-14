import { isCID } from "./isCID";
import { isNormalizedIPFSURL } from "./isNormalizedIPFSURL";
import { isIPFSUrl } from "./isIPFSUrl";
import { isGatewayIPFSUrl } from "./isGatewayIPFSUrl";

export type IPFSUrl = `ipfs://${string}`;

/**
 * Normalizes an IPFS URL.
 *
 * @param url - The IPFS URL to normalize.
 * @returns The normalized IPFS URL.
 */
export function normalizeIPFSUrl(url: string | null | undefined): IPFSUrl | null {
  if (!url || typeof url !== "string") return null;

  // Handle minor formatting noise: whitespace and wrapped quotes
  url = url.trim().replace(/^["']|["']$/g, "");

  // Normalize protocol-relative URLs before checks
  if (url.startsWith("//")) {
    url = url.replace(/^\/\//, "http://");
  }

  // Check if already a normalized IPFS url
  if (isNormalizedIPFSURL(url)) return url as IPFSUrl;

  // Check if url is a CID string
  if (isCID(url)) return `ipfs://${url}`;

  // If url is not either an ipfs gateway or protocol url
  if (!isIPFSUrl(url)) return null;

  // If url is already a gateway url, parse and normalize
  if (isGatewayIPFSUrl(url)) {
    // Parse URL (protocol-relative URLs already normalized above)
    const parsed = new URL(url);
    // Remove IPFS from the URL
    // http://gateway/ipfs/<CID>?x=y#z -> http://gateway/<CID>?x=y#z
    parsed.pathname = parsed.pathname.replace(/^\/ipfs\//, "");
    // Remove the protocol and host from the URL
    // http://gateway/<CID>?x=y#z -> <CID>?x=y#z
    const cid = parsed.toString().replace(`${parsed.protocol}//${parsed.host}/`, "");
    // Prepend ipfs protocol
    return `ipfs://${cid}`;
  }

  return null;
}
