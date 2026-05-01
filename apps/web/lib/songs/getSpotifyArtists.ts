export type SpotifyArtist = {
  id: string | null;
  name: string | null;
};

/**
 * Gets Spotify artists from an array of SpotifyArtist
 *
 * @param artists - The array of SpotifyArtist to get Spotify artists from
 * @returns An array of Spotify artists or undefined if the input is not an array
 */
export function getSpotifyArtists(artists: SpotifyArtist[]): SpotifyArtist[] | undefined {
  if (!Array.isArray(artists)) {
    return undefined;
  }

  const mapped = artists.map((artist: SpotifyArtist) => ({
    id: artist.id,
    name: artist.name,
  }));

  return mapped.length > 0 ? mapped : undefined;
}
