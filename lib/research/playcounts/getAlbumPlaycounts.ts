import { selectSongIdentifiers } from "@/lib/supabase/song_identifiers/selectSongIdentifiers";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { selectSongs } from "@/lib/supabase/songs/selectSongs";
import { deductCredits } from "@/lib/research/deductCredits";

const METRIC = "platform_displayed_play_count";

export type GetAlbumPlaycountsResult = { data: unknown } | { error: string; status: number };

const NO_SNAPSHOT_ERROR =
  "No snapshot exists for this album yet — create one with POST /api/research/snapshots";

/**
 * Latest platform-displayed play counts for every mapped track on an album,
 * served from the measurement store (no vendor calls). 404 when the album has
 * no identifier mappings or no captures yet. Deducts research credits only on
 * a successful read.
 *
 * @param params.accountId - The authenticated account
 * @param params.spotifyAlbumId - The Spotify album id
 */
export async function getAlbumPlaycounts(params: {
  accountId: string;
  spotifyAlbumId: string;
}): Promise<GetAlbumPlaycountsResult> {
  const albumRows = await selectSongIdentifiers({
    platform: "spotify",
    identifierType: "album_id",
    values: [params.spotifyAlbumId],
  });
  const isrcs = albumRows.map(r => r.song);
  if (isrcs.length === 0) return { error: NO_SNAPSHOT_ERROR, status: 404 };

  const measurements = await selectSongMeasurements({
    songs: isrcs,
    platform: "spotify",
    metric: METRIC,
  });
  if (measurements.length === 0) return { error: NO_SNAPSHOT_ERROR, status: 404 };

  const [trackIdRows, songs] = await Promise.all([
    selectSongIdentifiers({ platform: "spotify", identifierType: "track_id", songs: isrcs }),
    selectSongs(isrcs),
  ]);
  const trackIdBySong = new Map(trackIdRows.map(r => [r.song, r.value]));
  const songByIsrc = new Map(songs.map(s => [s.isrc, s]));

  // rows are newest-first; the first row per song is its latest capture
  const latestBySong = new Map<string, (typeof measurements)[number]>();
  for (const row of measurements) {
    if (!latestBySong.has(row.song)) latestBySong.set(row.song, row);
  }

  const playcounts = [...latestBySong.entries()].map(([isrc, row]) => ({
    isrc,
    spotify_track_id: trackIdBySong.get(isrc) ?? null,
    name: songByIsrc.get(isrc)?.name ?? null,
    platform_displayed_play_count: row.value,
    captured_at: row.captured_at,
    data_source: row.data_source,
  }));

  await deductCredits(params.accountId);

  return {
    data: {
      status: "success",
      album: {
        spotify_album_id: params.spotifyAlbumId,
        name: songByIsrc.values().next().value?.album ?? null,
        label: null,
        copyright: null,
      },
      playcounts,
    },
  };
}
