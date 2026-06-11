import { Tables } from "@/types/database.types";

const APIFY_SOURCE = "apify_spotify_playcount";

export type SpotifyHistoricStat = {
  source: "spotify";
  data: {
    history: Array<{ date: string; streams_total: number; data_source: string }>;
  };
};

/**
 * Shape store measurement rows into the per-source historic `stats[]` entry:
 * one point per date (the apify capture wins a same-date collision — it is
 * the fresher platform-displayed count), ascending by date, optionally
 * bounded by the request's `start_date`/`end_date`.
 *
 * @param rows - Measurement rows for the song (any order)
 * @param bounds.startDate - Inclusive lower bound (YYYY-MM-DD)
 * @param bounds.endDate - Inclusive upper bound (YYYY-MM-DD)
 * @returns The spotify historic stats entry
 */
export function buildSpotifyHistoricStat(
  rows: Tables<"song_measurements">[],
  bounds: { startDate?: string; endDate?: string },
): SpotifyHistoricStat {
  const byDate = new Map<string, { streams_total: number; data_source: string }>();

  for (const row of rows) {
    const date = row.captured_at.slice(0, 10);
    if (bounds.startDate && date < bounds.startDate) continue;
    if (bounds.endDate && date > bounds.endDate) continue;
    const existing = byDate.get(date);
    if (existing && existing.data_source === APIFY_SOURCE && row.data_source !== APIFY_SOURCE) {
      continue;
    }
    byDate.set(date, { streams_total: row.value, data_source: row.data_source });
  }

  const history = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, point]) => ({ date, ...point }));

  return { source: "spotify", data: { history } };
}
