import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { upsertSongMeasurements } from "@/lib/supabase/song_measurements/upsertSongMeasurements";
import { selectSongIdentifiers } from "@/lib/supabase/song_identifiers/selectSongIdentifiers";
import { fetchSpotifyAlbumPlayCounts } from "@/lib/apify/spotify/fetchSpotifyAlbumPlayCounts";
import { toStat, SpotifyStoreStat } from "@/lib/research/playcounts/toStat";
import { isFresh } from "@/lib/research/playcounts/isFresh";

const METRIC = "platform_displayed_play_count";
const DATA_SOURCE = "apify_spotify_playcount";

/**
 * Apify-first Spotify stat for one recording, served from the measurement
 * store. Fresh capture → serve it. Stale/missing → refresh the whole album
 * via one actor call (pricing is per album URL) and write every sibling track
 * that has an identifier mapping. Actor failure degrades to the stale capture,
 * or returns null when nothing is stored — the caller falls back to Songstats.
 *
 * @param isrc - The recording's ISRC
 * @returns A labeled stat entry, or null when the store can't answer
 */
export async function getSpotifyStatFromStore(isrc: string): Promise<SpotifyStoreStat | null> {
  const [latest] = await selectSongMeasurements({
    song: isrc,
    platform: "spotify",
    metric: METRIC,
    limit: 1,
  });
  if (latest && isFresh(latest.captured_at)) return toStat(latest);

  const albumIds = (
    await selectSongIdentifiers({ song: isrc, platform: "spotify", identifierType: "album_id" })
  ).map(r => r.value);
  if (albumIds.length === 0) return latest ? toStat(latest) : null;

  try {
    const { runId, albums } = await fetchSpotifyAlbumPlayCounts(albumIds);
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
        },
      ];
    });
    await upsertSongMeasurements(rows);

    const own = rows.find(r => r.song === isrc);
    if (own) return toStat(own);
  } catch (error) {
    console.error("[playcounts] spotify refresh failed:", error);
  }

  return latest ? toStat(latest) : null;
}
