const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/**
 * Pulls the scraped profile's display name out of a platform's raw dataset
 * items, so the digest can be addressed by artist instead of "Your artist"
 * (chat#1855). Returns null for platforms without a known shape.
 */
export function extractArtistNameFromDatasetItems(
  platform: string,
  items: unknown[],
): string | null {
  const first = asRecord(items[0]);
  switch (platform.toLowerCase()) {
    case "instagram":
      return str(first.fullName) ?? str(first.username);
    case "tiktok": {
      const author = asRecord(first.authorMeta);
      return str(author.nickName) ?? str(author.name);
    }
    case "twitter":
    case "x": {
      const author = asRecord(first.author);
      return str(author.name) ?? str(author.userName);
    }
    default:
      return null;
  }
}
