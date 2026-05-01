import { normalizeIPFSUrl } from "./normalizeIPFSUrl";

const IPFS_GATEWAY = "https://magic.decentralized-content.com";

/**
 * Returns the fetchable URL for an IPFS URL.
 *
 * @param url - The IPFS URL.
 * @returns The fetchable URL.
 */
export function ipfsGatewayUrl(url: string | null) {
  if (!url || typeof url !== "string") return null;
  const normalizedIPFSUrl = normalizeIPFSUrl(url);
  if (normalizedIPFSUrl) {
    return normalizedIPFSUrl.replace("ipfs://", `${IPFS_GATEWAY}/ipfs/`);
  }
  return null;
}
