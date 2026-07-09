import type { Tables } from "@/types/database.types";

type SongArtistLink = Pick<Tables<"song_artists">, "artist">;

/**
 * Resolves the canonical artist for a set of song-artist links: the artist
 * account holding the most links (chat#1850 P1 — on the repro snapshot the
 * canonical holds 67/67 ISRCs while collaborators hold one each). Ties break
 * deterministically on the lowest artist id so repeat claims resolve the same.
 *
 * @param songArtists - song_artists rows (or anything carrying `artist`)
 * @returns The dominant artist account id, or null when there are no links
 */
export function getDominantSongArtist(songArtists: SongArtistLink[]): string | null {
  const counts = new Map<string, number>();
  for (const { artist } of songArtists) {
    if (!artist) continue;
    counts.set(artist, (counts.get(artist) ?? 0) + 1);
  }

  let dominant: string | null = null;
  let dominantCount = 0;
  for (const [artist, count] of counts) {
    const wins = count > dominantCount || (count === dominantCount && artist < (dominant ?? ""));
    if (dominant === null || wins) {
      dominant = artist;
      dominantCount = count;
    }
  }

  return dominant;
}
