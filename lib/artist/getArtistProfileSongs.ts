import { selectSongArtists } from "@/lib/supabase/song_artists/selectSongArtists";
import { selectSongs } from "@/lib/supabase/songs/selectSongs";
import { selectLatestSongPlays } from "@/lib/songs/selectLatestSongPlays";
import { resolveSongArtwork } from "./resolveSongArtwork";
import type { ProfileSong } from "./buildProfileSongs";

const CHUNK_SIZE = 200;
const PROFILE_SONG_LIMIT = 1000;

/**
 * Resolve public recordings directly from artist credits, without catalog membership.
 */
export async function getArtistProfileSongs(
  artistId: string,
): Promise<Array<Omit<ProfileSong, "est_value_usd">>> {
  const credits = await selectSongArtists({ artists: [artistId], paginate: true });
  const isrcs = [...new Set(credits.map(row => row.song))];
  if (!isrcs.length) return [];

  const records = [];
  for (let i = 0; i < isrcs.length; i += CHUNK_SIZE) {
    records.push(...(await selectSongs(isrcs.slice(i, i + CHUNK_SIZE))));
  }
  const credited = new Set(isrcs);
  const unique = new Map(
    records.filter(song => credited.has(song.isrc)).map(song => [song.isrc, song]),
  );
  const [plays, artwork] = await Promise.all([
    selectLatestSongPlays([...unique.keys()]),
    resolveSongArtwork(
      [...unique.values()].filter(song => !song.artwork_url).map(song => song.isrc),
    ),
  ]);

  return [...unique.values()]
    .map(song => {
      const count = plays[song.isrc] ?? 0;
      return {
        isrc: song.isrc,
        name: song.name,
        album: song.album ?? null,
        artwork_url: artwork[song.isrc] ?? song.artwork_url ?? null,
        plays: count,
      };
    })
    .sort((a, b) => b.plays - a.plays || a.isrc.localeCompare(b.isrc))
    .slice(0, PROFILE_SONG_LIMIT);
}
