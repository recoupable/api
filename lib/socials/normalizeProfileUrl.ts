/**
 * Normalizes a profile URL by removing the protocol and trailing slash.
 * This ensures consistent URL format for database queries and storage.
 *
 * @param url - The profile URL to normalize
 * @returns The normalized URL without protocol or trailing slash
 */
export function normalizeProfileUrl(url: string | null | undefined): string {
  if (!url) return "";

  return url
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}
