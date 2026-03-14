export type ArweaveURL = `ar://${string}`;

/**
 * Checks if a URL is an Arweave URL.
 *
 * @param url - The URL to check.
 * @returns True if the URL is an Arweave URL, false otherwise.
 */
export function isArweaveURL(url: string | null | undefined): boolean {
  return url && typeof url === "string" ? url.startsWith("ar://") : false;
}
