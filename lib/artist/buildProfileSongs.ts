import { computeValuationBand, type ValuationBand } from "@/lib/catalog/computeValuationBand";

/** A public unauthenticated endpoint gets a fixed cap, not pagination. */
const SONGS_PER_CATALOG_CAP = 50;

export type ProfileSong = {
  isrc: string;
  name: string;
  album: string | null;
  artwork_url: string | null;
  plays: number;
  est_value_usd: number;
};

type BuildProfileSongsParams = {
  catalogSongRows: Array<{ catalog: string; song: string }>;
  songs: Array<{ isrc: string; name: string; album: string | null; artwork_url: string | null }>;
  plays: Record<string, number>;
  artwork: Record<string, string>;
  earliestReleaseDates: Record<string, string | null>;
};

/**
 * Shape the per-catalog song lists and the artist-level valuation for the
 * public profile. Every dollar figure delegates to `computeValuationBand` —
 * the published valuation-report model — with no copied constants: per-song
 * rows carry the mid estimate for that song's plays, and the artist band is
 * the model over all credited plays with the earliest release date across
 * catalogs.
 *
 * Songs sort by plays descending and cap at the top 50 per catalog.
 */
export function buildProfileSongs(params: BuildProfileSongsParams): {
  songsByCatalog: Record<string, ProfileSong[]>;
  valuation: ValuationBand | null;
} {
  const { catalogSongRows, songs, plays, artwork, earliestReleaseDates } = params;
  const songByIsrc = new Map(songs.map(s => [s.isrc, s]));

  const songsByCatalog: Record<string, ProfileSong[]> = {};
  for (const row of catalogSongRows) {
    const song = songByIsrc.get(row.song);
    if (!song) continue;
    const songPlays = plays[row.song] ?? 0;
    const earliest = earliestReleaseDates[row.catalog] ?? null;
    const est =
      songPlays > 0
        ? computeValuationBand({ totalStreams: songPlays, earliestReleaseDate: earliest }).valuation
            .mid
        : 0;
    (songsByCatalog[row.catalog] ??= []).push({
      isrc: song.isrc,
      name: song.name,
      album: song.album,
      artwork_url: artwork[song.isrc] ?? song.artwork_url ?? null,
      plays: songPlays,
      est_value_usd: est,
    });
  }
  for (const catalogId of Object.keys(songsByCatalog)) {
    songsByCatalog[catalogId] = songsByCatalog[catalogId]
      .sort((a, b) => b.plays - a.plays)
      .slice(0, SONGS_PER_CATALOG_CAP);
  }

  const totalStreams = Object.values(plays).reduce((sum, v) => sum + v, 0);
  const dates = Object.values(earliestReleaseDates).filter((d): d is string => !!d);
  const earliestOverall = dates.length ? dates.sort()[0] : null;
  const valuation =
    totalStreams > 0
      ? computeValuationBand({ totalStreams, earliestReleaseDate: earliestOverall }).valuation
      : null;

  return { songsByCatalog, valuation };
}
