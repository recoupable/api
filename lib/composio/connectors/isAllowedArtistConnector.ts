/**
 * List of toolkit slugs that artists are allowed to connect.
 * Only these connectors will be shown in the artist-connectors API.
 *
 * `twitter` is artist-facing social, same class as the existing three.
 * `linkedin` is intentionally excluded — it is label/owner-only.
 */
export const ALLOWED_ARTIST_CONNECTORS = ["tiktok", "instagram", "youtube", "twitter"] as const;

export type AllowedArtistConnector = (typeof ALLOWED_ARTIST_CONNECTORS)[number];

/**
 * Check if a connector slug is an allowed artist connector.
 *
 * @param slug
 */
export function isAllowedArtistConnector(slug: string): slug is AllowedArtistConnector {
  return (ALLOWED_ARTIST_CONNECTORS as readonly string[]).includes(slug);
}
