import { fetchSongstatsResearch } from "@/lib/research/songstats/fetchSongstatsResearch";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves an artist identifier (name, UUID, or legacy numeric provider ID) to
 * a provider artist ID.
 *
 * - Legacy numeric string → used directly as provider ID
 * - UUID → future: look up mapping. For now, returns error.
 * - String → searches the configured provider by name, returns top match ID
 *
 * @param artist - Artist name, Recoup artist ID (UUID), or numeric ID
 * @returns The provider artist ID, or null if not found
 */
export async function resolveArtist(
  artist: string,
): Promise<{ id: string; error?: never } | { id?: never; error: string }> {
  if (!artist || !artist.trim()) {
    return { error: "artist parameter is required" };
  }

  const trimmed = artist.trim();

  if (/^\d+$/.test(trimmed)) {
    return { id: trimmed };
  }

  if (UUID_REGEX.test(trimmed)) {
    // TODO: Look up Recoup artist ID → provider artist ID mapping in database
    return {
      error: "Recoup artist ID resolution is not yet implemented. Use an artist name instead.",
    };
  }

  const result = await fetchSongstatsResearch("/search", {
    q: trimmed,
    type: "artists",
    limit: "1",
  });

  if (result.status !== 200) {
    return { error: `Search failed with status ${result.status}` };
  }

  const data = result.data as {
    artists?: Array<{ id?: string | number; songstats_artist_id?: string | number; name: string }>;
  };
  const artists = data?.artists;

  if (!artists || artists.length === 0) {
    return { error: `No artist found matching "${trimmed}"` };
  }

  const id = artists[0].id ?? artists[0].songstats_artist_id;
  if (id === undefined || id === null || id === "") {
    return { error: `No provider artist ID found for "${trimmed}"` };
  }

  return { id: String(id) };
}
