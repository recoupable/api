import { isArweaveURL } from "./arweave";
import { isNormalizeableIPFSUrl } from "./isNormalizeableIPFSUrl";
import { arweaveGatewayUrl } from "./arweaveGatewayUrl";
import { ipfsGatewayUrl } from "./ipfsGatewayUrl";

/**
 * Returns the fetchable URL for a URI.
 *
 * @param uri - The URI.
 * @returns The fetchable URL.
 */
export function getFetchableUrl(uri: string | null | undefined): string | null {
  if (!uri || typeof uri !== "string") return null;

  // Prevent fetching from insecure URLs
  if (uri.startsWith("http://")) return null;

  // If it is an IPFS HTTP or ipfs:// url
  if (isNormalizeableIPFSUrl(uri)) {
    // Return a fetchable gateway url
    return ipfsGatewayUrl(uri);
  }

  // If it is a ar:// url
  if (isArweaveURL(uri)) {
    // Return a fetchable gateway url
    return arweaveGatewayUrl(uri);
  }

  // If it is already a url (or blob or data-uri)
  if (/^(https|data|blob):/.test(uri)) {
    // Return the URI
    return uri;
  }

  return null;
}
