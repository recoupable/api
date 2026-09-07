import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";

const CHUNK_SIZE = 200;

/** Find the newest capture across bounded PostgREST requests for a public song group. */
export async function getLatestProfileMeasurementAt(isrcs: string[]): Promise<string | null> {
  let latest: string | null = null;
  for (let offset = 0; offset < isrcs.length; offset += CHUNK_SIZE) {
    const [row] = await selectSongMeasurements({
      songs: isrcs.slice(offset, offset + CHUNK_SIZE),
      platform: "spotify",
      metric: "platform_displayed_play_count",
      limit: 1,
    });
    if (row && (!latest || Date.parse(row.captured_at) > Date.parse(latest))) {
      latest = row.captured_at;
    }
  }
  return latest;
}
