/**
 * List of toolkit slugs that artists are allowed to connect.
 * Only these connectors will be shown in the artist-connectors API.
 */
export const ALLOWED_ARTIST_CONNECTORS = ["tiktok", "instagram"] as const;

export type AllowedArtistConnector = (typeof ALLOWED_ARTIST_CONNECTORS)[number];

/**
 * Is Allowed Artist Connector.
 *
 * @param slug - Parameter.
 * @returns - Result.
 */
export function isAllowedArtistConnector(slug: string): slug is AllowedArtistConnector {
  return (ALLOWED_ARTIST_CONNECTORS as readonly string[]).includes(slug);
}
