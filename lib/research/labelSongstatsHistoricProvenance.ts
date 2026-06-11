import { HistoricStatsPayload } from "@/lib/research/playcounts/historicStatsPayloadSchema";

/**
 * Label every history point of every Songstats-sourced entry with its
 * provenance (`data_source: "songstats"`), per the contract in docs#238.
 * Pure typed transform — the payload is validated once at the orchestrator
 * boundary ({@link historicStatsPayloadSchema}).
 *
 * @param payload - The parsed Songstats historic payload
 * @returns The payload with per-point labels
 */
export function labelSongstatsHistoricProvenance(
  payload: HistoricStatsPayload,
): HistoricStatsPayload {
  if (!payload.stats) return payload;
  return {
    ...payload,
    stats: payload.stats.map(entry => {
      if (!entry.data?.history) return entry;
      return {
        ...entry,
        data: {
          ...entry.data,
          history: entry.data.history.map(point => ({ ...point, data_source: "songstats" })),
        },
      };
    }),
  };
}
