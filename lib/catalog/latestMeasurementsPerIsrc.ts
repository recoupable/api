import type { Tables } from "@/types/database.types";

export type CatalogTrackMeasurement = {
  isrc: string;
  title: string | null;
  playcount: number;
  measured_at: string;
};

/**
 * Reduce a newest-first measurement series to the latest capture per ISRC,
 * shaped for the response, sorted by playcount descending, plus the total.
 *
 * @param rows - Measurement rows ordered captured_at desc (selectSongMeasurements order)
 * @param titles - Song titles by ISRC (from the catalog's songs)
 */
export function latestMeasurementsPerIsrc(
  rows: Tables<"song_measurements">[],
  titles: Map<string, string | null>,
): { measurements: CatalogTrackMeasurement[]; totalStreams: number } {
  const latest = new Map<string, CatalogTrackMeasurement>();
  for (const row of rows) {
    if (latest.has(row.song)) continue; // newest-first: first row per ISRC wins
    latest.set(row.song, {
      isrc: row.song,
      title: titles.get(row.song) ?? null,
      playcount: row.value,
      measured_at: row.captured_at,
    });
  }

  const measurements = [...latest.values()].sort((a, b) => b.playcount - a.playcount);
  const totalStreams = measurements.reduce((sum, m) => sum + m.playcount, 0);
  return { measurements, totalStreams };
}
