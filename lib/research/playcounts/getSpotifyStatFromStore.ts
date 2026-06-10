import { selectLatestSongMeasurement } from "@/lib/supabase/song_measurements/selectLatestSongMeasurement";
import { insertSongMeasurements } from "@/lib/supabase/song_measurements/insertSongMeasurements";
import { selectSongIdentifiers } from "@/lib/supabase/song_identifiers/selectSongIdentifiers";
import { selectSongsByIdentifierValues } from "@/lib/supabase/song_identifiers/selectSongsByIdentifierValues";
import { fetchSpotifyAlbumPlayCounts } from "@/lib/apify/spotify/fetchSpotifyAlbumPlayCounts";
import { Tables } from "@/types/database.types";

const METRIC = "platform_displayed_play_count";
const DATA_SOURCE = "apify_spotify_playcount";
const DEFAULT_TTL_HOURS = 24;

export type SpotifyStoreStat = {
  source: "spotify";
  data: { streams_total: number };
  data_source: string;
  captured_at: string;
};

function toStat(row: Pick<Tables<"song_measurements">, "value" | "captured_at" | "data_source">) {
  return {
    source: "spotify" as const,
    data: { streams_total: row.value },
    data_source: row.data_source,
    captured_at: row.captured_at,
  };
}

function isFresh(capturedAt: string): boolean {
  const ttlHours = Number(process.env.SPOTIFY_PLAYCOUNT_TTL_HOURS) || DEFAULT_TTL_HOURS;
  return Date.now() - new Date(capturedAt).getTime() < ttlHours * 60 * 60 * 1000;
}

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
  const latest = await selectLatestSongMeasurement(isrc, "spotify", METRIC);
  if (latest && isFresh(latest.captured_at)) return toStat(latest);

  const albumIds = (await selectSongIdentifiers(isrc, "spotify", "album_id")).map(r => r.value);
  if (albumIds.length === 0) return latest ? toStat(latest) : null;

  try {
    const { runId, albums } = await fetchSpotifyAlbumPlayCounts(albumIds);
    const tracks = albums.flatMap(album => album.tracks ?? []);
    const mappings = await selectSongsByIdentifierValues(
      "spotify",
      "track_id",
      tracks.map(t => t.id),
    );
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
    await insertSongMeasurements(rows);

    const own = rows.find(r => r.song === isrc);
    if (own) return toStat(own);
  } catch (error) {
    console.error("[playcounts] spotify refresh failed:", error);
  }

  return latest ? toStat(latest) : null;
}
