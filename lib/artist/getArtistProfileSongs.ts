import { selectSongArtists } from "@/lib/supabase/song_artists/selectSongArtists";
import { selectSongs } from "@/lib/supabase/songs/selectSongs";
import { selectLatestSongPlays } from "@/lib/songs/selectLatestSongPlays";
import { resolveSongArtwork } from "./resolveSongArtwork";
import { computeValuationBand } from "@/lib/catalog/computeValuationBand";
import type { ProfileSong } from "./buildProfileSongs";

const CHUNK_SIZE = 200;
const PROFILE_SONG_LIMIT = 1000;

/**
 * Resolve public recordings directly from artist credits, without catalog membership.
 * Song release dates are not stored, so row estimates use the model's default age.
 */
export async function getArtistProfileSongs(artistId: string): Promise<ProfileSong[]> {
  const credits = await selectSongArtists({ artists: [artistId] });
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
        est_value_usd:
          count > 0
            ? computeValuationBand({ totalStreams: count, earliestReleaseDate: null }).valuation.mid
            : 0,
      };
    })
    .sort((a, b) => b.plays - a.plays || a.isrc.localeCompare(b.isrc))
    .slice(0, PROFILE_SONG_LIMIT);
}
