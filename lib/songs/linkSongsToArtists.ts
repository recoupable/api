import { SongWithSpotify } from "./getSongsByIsrc";
import { getPreferredArtistAccountIds } from "@/lib/supabase/songs/getPreferredArtistAccountIds";
import { insertSongArtists } from "@/lib/supabase/song_artists/insertSongArtists";
import { attachSpotifySocialsToArtists } from "./attachSpotifySocialsToArtists";

/**
 * Links songs to artists, and attaches each resolved artist account's Spotify
 * profile when it lacks one (chat#1850 P1 — auto-created canonical artists
 * had zero socials, making them unfindable by Spotify id).
 *
 * @param songs - The songs to link to artists
 * @returns A promise that resolves when the songs are linked to artists
 * @throws Error if the songs are not linked to artists
 */
export async function linkSongsToArtists(songs: SongWithSpotify[]): Promise<void> {
  const normalizedToOriginal = new Map<string, string>();
  const spotifyIdByNormalized = new Map<string, string>();

  songs.forEach(song => {
    (song.spotifyArtists ?? []).forEach(artist => {
      const trimmed = artist?.name?.trim();
      if (!trimmed) return;

      const normalized = trimmed.toLowerCase();
      if (!normalizedToOriginal.has(normalized)) {
        normalizedToOriginal.set(normalized, trimmed);
      }
      const spotifyId = artist?.id?.trim();
      if (spotifyId && !spotifyIdByNormalized.has(normalized)) {
        spotifyIdByNormalized.set(normalized, spotifyId);
      }
    });
  });

  if (normalizedToOriginal.size === 0) {
    return;
  }

  const uniqueArtistNames = Array.from(normalizedToOriginal.values());

  const nameToAccountId = await getPreferredArtistAccountIds(uniqueArtistNames);

  const songArtists = songs.flatMap(song => {
    const artistIds = new Set<string>();

    (song.spotifyArtists ?? []).forEach(artist => {
      const normalized = artist?.name?.trim().toLowerCase();
      if (!normalized) return;

      const accountId = nameToAccountId.get(normalized);
      if (accountId) {
        artistIds.add(accountId);
      }
    });

    return Array.from(artistIds).map(artistId => ({
      song: song.isrc,
      artist: artistId,
    }));
  });

  await insertSongArtists(songArtists);

  await attachSpotifySocialsToArtists(
    [...spotifyIdByNormalized.entries()].flatMap(([normalized, spotifyArtistId]) => {
      const artistAccountId = nameToAccountId.get(normalized);
      return artistAccountId ? [{ artistAccountId, spotifyArtistId }] : [];
    }),
  );
}
