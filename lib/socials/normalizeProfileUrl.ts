/**
 * Normalizes a profile URL by removing the protocol, www. prefix, and trailing slash,
 * and canonicalizing domain aliases so equivalent profiles produce one upsert key.
 * This ensures consistent URL format for database queries and storage.
 *
 * Domain aliases: `twitter.com` → `x.com` (official domain, and what the Apify
 * actor echoes). Without this, scrape write-backs land on an `x.com/*` twin row
 * while artists stay connected to a stale `twitter.com/*` row (chat#1851).
 *
 * @param url - The profile URL to normalize
 * @returns The normalized URL without protocol, www., or trailing slash
 */
export function normalizeProfileUrl(url: string | null | undefined): string {
  if (!url) return "";

  const stripped = url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");

  return stripped.replace(/^twitter\.com(\/|$)/i, "x.com$1");
}
