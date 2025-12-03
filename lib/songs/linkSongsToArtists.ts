import { SongWithSpotify } from "./getSongsByIsrc";
import { getPreferredArtistAccountIds } from "@/lib/supabase/songs/getPreferredArtistAccountIds";
import { insertSongArtists } from "@/lib/supabase/song_artists/insertSongArtists";

/**
 * Links songs to artists
 *
 * @param songs - The songs to link to artists
 * @returns A promise that resolves when the songs are linked to artists
 * @throws Error if the songs are not linked to artists
 */
export async function linkSongsToArtists(songs: SongWithSpotify[]): Promise<void> {
  const normalizedToOriginal = new Map<string, string>();

  songs.forEach(song => {
    (song.spotifyArtists ?? []).forEach(artist => {
      const trimmed = artist?.name?.trim();
      if (!trimmed) return;

      const normalized = trimmed.toLowerCase();
      if (!normalizedToOriginal.has(normalized)) {
        normalizedToOriginal.set(normalized, trimmed);
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
}
