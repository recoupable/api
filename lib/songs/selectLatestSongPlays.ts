import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";

/** PostgREST `in` filters ride the URL, so large ISRC lists are chunked. */
const CHUNK_SIZE = 200;

/**
 * Latest Spotify play count per song. Measurements come back newest-first,
 * so the first row seen per song wins. A query failure yields no data rather
 * than failing the caller — plays back a public page.
 *
 * @param isrcs - Song ISRCs to look up.
 * @returns Record of ISRC → latest `platform_displayed_play_count`.
 */
export async function selectLatestSongPlays(isrcs: string[]): Promise<Record<string, number>> {
  if (!isrcs.length) return {};

  const plays: Record<string, number> = {};
  for (let i = 0; i < isrcs.length; i += CHUNK_SIZE) {
    const chunk = isrcs.slice(i, i + CHUNK_SIZE);
    try {
      const rows = await selectSongMeasurements({
        songs: chunk,
        platform: "spotify",
        metric: "platform_displayed_play_count",
      });
      for (const row of rows ?? []) {
        if (!(row.song in plays)) plays[row.song] = row.value;
      }
    } catch (error) {
      console.error("Error fetching latest song plays:", error);
    }
  }
  return plays;
}
