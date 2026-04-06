import { proxyToChartmetric } from "@/lib/research/proxyToChartmetric";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves an artist identifier (name, UUID, or numeric ID) to a Chartmetric artist ID.
 *
 * - Numeric string → used directly as Chartmetric ID
 * - UUID → future: look up mapping. For now, returns error.
 * - String → searches Chartmetric by name, returns top match ID
 *
 * @param artist - Artist name, Recoup artist ID (UUID), or numeric ID
 * @returns The Chartmetric artist ID, or null if not found
 */
export async function resolveArtist(
  artist: string,
): Promise<{ id: number; error?: never } | { id?: never; error: string }> {
  if (!artist || !artist.trim()) {
    return { error: "artist parameter is required" };
  }

  const trimmed = artist.trim();

  if (/^\d+$/.test(trimmed)) {
    return { id: parseInt(trimmed, 10) };
  }

  if (UUID_REGEX.test(trimmed)) {
    // TODO: Look up Recoup artist ID → Chartmetric ID mapping in database
    return {
      error: "Recoup artist ID resolution is not yet implemented. Use an artist name instead.",
    };
  }

  const result = await proxyToChartmetric("/search", {
    q: trimmed,
    type: "artists",
    limit: "1",
  });

  if (result.status !== 200) {
    return { error: `Search failed with status ${result.status}` };
  }

  const data = result.data as { artists?: Array<{ id: number; name: string }> };
  const artists = data?.artists;

  if (!artists || artists.length === 0) {
    return { error: `No artist found matching "${trimmed}"` };
  }

  return { id: artists[0].id };
}
