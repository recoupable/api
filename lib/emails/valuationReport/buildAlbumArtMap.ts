import type { SpotifyAlbum } from "@/lib/spotify/getAlbums";

/**
 * Map each album name (trimmed, lowercased) to its smallest cover-art URL from
 * a Spotify /v1/albums response. Spotify returns images largest-first, so the
 * last entry is the ~64px thumbnail best suited to an email row.
 */
export function buildAlbumArtMap(albums: SpotifyAlbum[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const album of albums ?? []) {
    const name = album?.name?.trim().toLowerCase();
    const images = album?.images ?? [];
    const url = images[images.length - 1]?.url;
    if (name && url && !map.has(name)) map.set(name, url);
  }
  return map;
}
