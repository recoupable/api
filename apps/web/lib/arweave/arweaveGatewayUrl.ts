const ARWEAVE_GATEWAY = "https://arweave.net";

/**
 * Returns the fetchable URL for an Arweave URL.
 *
 * @param normalizedArweaveUrl - The normalized Arweave URL.
 * @returns The fetchable URL.
 */
export function arweaveGatewayUrl(normalizedArweaveUrl: string | null) {
  if (!normalizedArweaveUrl || typeof normalizedArweaveUrl !== "string") return null;
  return normalizedArweaveUrl.replace("ar://", `${ARWEAVE_GATEWAY}/`);
}
