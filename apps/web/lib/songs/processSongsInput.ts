import { TablesInsert } from "@/types/database.types";
import getSongsByIsrc, { SongWithSpotify } from "./getSongsByIsrc";
import { upsertSongs } from "@/lib/supabase/songs/upsertSongs";
import { linkSongsToArtists } from "./linkSongsToArtists";
import { queueRedisSongs } from "./queueRedisSongs";
import { mapArtistsFallback } from "./mapArtistsFallback";
import { formatSongsInput, type SongInput } from "./formatSongsInput";

/**
 * Processes songs input with artists fallback support
 *
 * @param songsInput - The songs input to process
 * @returns A promise that resolves when the songs input is processed
 * @throws Error if the songs input is invalid
 */
export async function processSongsInput(songsInput: SongInput[]): Promise<void> {
  // Format input: extract artists and prepare for upsert
  const { songsForUpsert, artistsByIsrc } = formatSongsInput(songsInput);

  // Extract unique songs (by ISRC) and prepare for upsert
  const songMap = new Map<string, TablesInsert<"songs">>();

  songsForUpsert.forEach(song => {
    if (!song.isrc) return;

    songMap.set(song.isrc, song);
  });

  const uniqueSongs = Array.from(songMap.values());

  if (uniqueSongs.length === 0) return;

  const enrichedSongs = await getSongsByIsrc(uniqueSongs);

  const songsWithArtists: SongWithSpotify[] = mapArtistsFallback(enrichedSongs, artistsByIsrc);

  const songsToUpsert = songsWithArtists.map(song => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { spotifyArtists, ...songRecord } = song;
    return songRecord;
  });

  await upsertSongs(songsToUpsert);

  await linkSongsToArtists(songsWithArtists);

  await queueRedisSongs(songsWithArtists);
}
