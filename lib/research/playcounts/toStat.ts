import { Tables } from "@/types/database.types";

export type SpotifyStoreStat = {
  source: "spotify";
  data: { streams_total: number };
  data_source: string;
  captured_at: string;
};

/**
 * Shape a measurement-store row into the `stats[]` entry envelope served by
 * `GET /api/research/track/stats`.
 *
 * @param row - The measurement row (value, capture time, provenance)
 * @returns The labeled per-source stat entry
 */
export function toStat(
  row: Pick<Tables<"song_measurements">, "value" | "captured_at" | "data_source">,
): SpotifyStoreStat {
  return {
    source: "spotify",
    data: { streams_total: row.value },
    data_source: row.data_source,
    captured_at: row.captured_at,
  };
}
