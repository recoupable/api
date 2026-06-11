import { selectSongIdentifiers } from "@/lib/supabase/song_identifiers/selectSongIdentifiers";
import { upsertSongMeasurements } from "@/lib/supabase/song_measurements/upsertSongMeasurements";
import { SpotifyAlbumPlayCounts } from "@/lib/apify/spotify/fetchSpotifyAlbumPlayCounts";

const METRIC = "platform_displayed_play_count";
const DATA_SOURCE = "apify_spotify_playcount";

/**
 * Write actor album results into the measurement store: one row per track
 * with an identifier mapping, stamped with the actor run id (and snapshot id
 * when capturing for a snapshot job). Shared by the on-demand stats refresh
 * and the snapshot workflow.
 *
 * @param albums - Parsed actor album items
 * @param runId - The actor run id (raw_ref lineage)
 * @param opts.snapshotId - Optional snapshot job lineage
 * @returns Number of measurements written
 */
export async function writeAlbumPlayCounts(
  albums: SpotifyAlbumPlayCounts[],
  runId: string,
  opts: { snapshotId?: string },
): Promise<number> {
  const tracks = albums.flatMap(album => album.tracks ?? []);
  const mappings = await selectSongIdentifiers({
    platform: "spotify",
    identifierType: "track_id",
    values: tracks.map(t => t.id),
  });
  const songByTrackId = new Map(mappings.map(m => [m.value, m.song]));
  const capturedAt = new Date().toISOString();

  const rows = tracks.flatMap(track => {
    const song = songByTrackId.get(track.id);
    if (!song || typeof track.streamCount !== "number") return [];
    return [
      {
        song,
        platform: "spotify",
        metric: METRIC,
        value: track.streamCount,
        captured_at: capturedAt,
        data_source: DATA_SOURCE,
        raw_ref: runId,
        ...(opts.snapshotId ? { snapshot: opts.snapshotId } : {}),
      },
    ];
  });
  await upsertSongMeasurements(rows);
  return rows.length;
}
